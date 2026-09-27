"""
Serviço de importação de extratos bancários em formato .PDF.

Extratos em PDF não têm um "fitid" nativo (esse campo só existe no padrão OFX),
então geramos um fitid sintético e determinístico a partir de
(data + descrição + valor), prefixado com "PDF-". Isso garante que reimportar
o mesmo PDF não duplique lançamentos, respeitando a mesma constraint única
(empresa_id, fitid_ofx) usada para OFX.

Requer: pip install pdfplumber
"""

import hashlib
import re
from datetime import date, datetime
from io import BytesIO

import pdfplumber
from sqlalchemy.orm import Session

from app.models import StatusConciliacao, TipoTransacao, TransacaoBancaria

PADRAO_DATA = re.compile(r"(\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2})")
PADRAO_VALOR = re.compile(r"-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+\.\d{2}")


def _parse_data(texto: str) -> date | None:
    texto = texto.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            continue
    return None


def _parse_valor(texto: str) -> float | None:
    texto = texto.strip().replace(".", "").replace(",", ".")
    try:
        return float(texto)
    except ValueError:
        return None


def _gerar_fitid_sintetico(empresa_id: str, data_lanc: date, descricao: str, valor: float) -> str:
    base = f"{empresa_id}|{data_lanc.isoformat()}|{descricao.strip().upper()}|{valor:.2f}"
    return "PDF-" + hashlib.sha256(base.encode("utf-8")).hexdigest()[:24]


def _extrair_linhas_de_tabelas(pdf: pdfplumber.PDF) -> list[dict]:
    """
    Estratégia 1: extrai tabelas estruturadas via pdfplumber.extract_tables(),
    tentando identificar colunas de Data, Histórico e Valor pelo cabeçalho.
    """
    linhas_encontradas = []

    for page in pdf.pages:
        tabelas = page.extract_tables()
        for tabela in tabelas:
            if not tabela or len(tabela) < 2:
                continue

            cabecalho = [str(c or "").strip().lower() for c in tabela[0]]

            idx_data = next(
                (i for i, c in enumerate(cabecalho) if "data" in c), None
            )
            idx_historico = next(
                (
                    i
                    for i, c in enumerate(cabecalho)
                    if any(p in c for p in ("histor", "descri", "lançamento", "lancamento"))
                ),
                None,
            )
            idx_valor = next(
                (i for i, c in enumerate(cabecalho) if "valor" in c), None
            )

            if idx_data is None or idx_valor is None:
                continue  # tabela não parece ser um extrato

            for linha in tabela[1:]:
                if idx_data >= len(linha) or idx_valor >= len(linha):
                    continue

                data_bruta = str(linha[idx_data] or "")
                valor_bruto = str(linha[idx_valor] or "")
                descricao = (
                    str(linha[idx_historico]) if idx_historico is not None and idx_historico < len(linha) else ""
                ) or ""

                match_data = PADRAO_DATA.search(data_bruta)
                match_valor = PADRAO_VALOR.search(valor_bruto)
                if not match_data or not match_valor:
                    continue

                data_lanc = _parse_data(match_data.group())
                valor = _parse_valor(match_valor.group())
                if data_lanc is None or valor is None:
                    continue

                linhas_encontradas.append(
                    {"data": data_lanc, "descricao": descricao.strip(), "valor": valor}
                )

    return linhas_encontradas


def _extrair_linhas_por_regex(pdf: pdfplumber.PDF) -> list[dict]:
    """
    Estratégia 2 (fallback): quando o PDF não tem tabelas estruturadas
    detectáveis, varremos o texto linha a linha procurando o padrão
    "DATA ... DESCRIÇÃO ... VALOR" na mesma linha.
    """
    linhas_encontradas = []

    for page in pdf.pages:
        texto = page.extract_text() or ""
        for linha_texto in texto.split("\n"):
            match_data = PADRAO_DATA.search(linha_texto)
            match_valor = PADRAO_VALOR.search(linha_texto)
            if not match_data or not match_valor:
                continue

            data_lanc = _parse_data(match_data.group())
            valor = _parse_valor(match_valor.group())
            if data_lanc is None or valor is None:
                continue

            descricao = linha_texto.replace(match_data.group(), "").replace(match_valor.group(), "").strip(" -|")

            linhas_encontradas.append({"data": data_lanc, "descricao": descricao, "valor": valor})

    return linhas_encontradas


def processar_pdf_extrato(conteudo_arquivo: bytes, empresa_id: str, db: Session) -> dict:
    resultado = {"processados": 0, "duplicados_ignorados": 0, "erros": []}

    try:
        with pdfplumber.open(BytesIO(conteudo_arquivo)) as pdf:
            linhas = _extrair_linhas_de_tabelas(pdf)
            if not linhas:
                linhas = _extrair_linhas_por_regex(pdf)
    except Exception as e:
        resultado["erros"].append(f"Falha ao abrir/ler o PDF: {e}")
        return resultado

    if not linhas:
        resultado["erros"].append(
            "Não foi possível identificar colunas de Data/Histórico/Valor no PDF."
        )
        return resultado

    novas: list[TransacaoBancaria] = []
    fitids_vistos: set[str] = set()

    fitids_candidatos = []
    linhas_com_fitid = []
    for linha in linhas:
        fitid = _gerar_fitid_sintetico(empresa_id, linha["data"], linha["descricao"], linha["valor"])
        linhas_com_fitid.append((fitid, linha))
        fitids_candidatos.append(fitid)

    fitids_existentes: set[str] = set()
    if fitids_candidatos:
        rows = (
            db.query(TransacaoBancaria.fitid_ofx)
            .filter(
                TransacaoBancaria.empresa_id == empresa_id,
                TransacaoBancaria.fitid_ofx.in_(fitids_candidatos),
            )
            .all()
        )
        fitids_existentes = {r[0] for r in rows}

    for fitid, linha in linhas_com_fitid:
        if fitid in fitids_existentes or fitid in fitids_vistos:
            resultado["duplicados_ignorados"] += 1
            continue

        novas.append(
            TransacaoBancaria(
                empresa_id=empresa_id,
                fitid_ofx=fitid,
                data=linha["data"],
                descricao_extrato=linha["descricao"],
                valor=abs(linha["valor"]),
                tipo=TipoTransacao.ENTRADA if linha["valor"] >= 0 else TipoTransacao.SAIDA,
                status_conciliacao=StatusConciliacao.PENDENTE,
            )
        )
        fitids_vistos.add(fitid)

    try:
        if novas:
            db.add_all(novas)
            db.commit()
        resultado["processados"] = len(novas)
    except Exception as e:
        db.rollback()
        resultado["erros"].append(f"Falha ao salvar transações: {e}")

    return resultado
