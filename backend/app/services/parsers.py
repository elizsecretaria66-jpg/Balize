"""
Interpretação de textos de extratos e comprovantes.

Funções puras (sem banco de dados, sem OCR): recebem texto/tabelas e devolvem
dados estruturados. Isso permite testar a leitura sem subir o sistema inteiro.
"""

import hashlib
import re
import unicodedata
from datetime import date

MESES = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
}

_DINHEIRO = r"\(?-?\d{1,3}(?:\.\d{3})*,\d{2}-?\)?|\(?-?\d+,\d{2}-?\)?"
RE_DINHEIRO = re.compile(_DINHEIRO)
RE_DINHEIRO_TOKEN = re.compile(rf"^(?:{_DINHEIRO})$")

RE_DATA_ANY = re.compile(
    r"(?<!\d)(?:\d{4}-\d{2}-\d{2}"
    r"|\d{1,2}[/\-.]\d{1,2}[/\-.](?:\d{4}|\d{2})(?!\d)"
    r"|\d{1,2}\s*(?:de\s+)?[A-Za-zçÇãÃ]{3,9}\.?\s*(?:de\s+)?\d{4})",
    re.I,
)
RE_DATA_INICIO_LINHA = re.compile(
    r"^\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/\-.]\d{1,2}[/\-.](?:\d{4}|\d{2}))(?!\d)\s+(.*)$"
)

RE_CNPJ = re.compile(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}")
RE_CPF = re.compile(r"\d{3}\.\d{3}\.\d{3}-\d{2}")


def _sem_acento(s: str) -> str:
    return unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()


def eh_traco(t: str) -> bool:
    return t.strip() in {"", "—", "–", "-", "--", "−"}


# ---------------------------------------------------------------- valores/datas
def parse_dinheiro(txt) -> float | None:
    """'R$ 1.234,56' -> 1234.56 · '(12,00)' ou '12,00-' -> -12.0 · '—' -> None."""
    if txt is None:
        return None
    t = str(txt).replace("R$", "").replace(" ", "").strip()
    if not t or eh_traco(t):
        return None
    negativo = t.startswith("-") or t.endswith("-") or (t.startswith("(") and t.endswith(")"))
    t = t.strip("()-")
    if not re.fullmatch(r"\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}", t):
        return None
    v = float(t.replace(".", "").replace(",", "."))
    return -v if negativo else v


def parse_data(txt) -> date | None:
    """Aceita 02/09/2026, 02/09/26, 2026-09-02, '2 set 2026' e '2 de setembro de 2026'."""
    if not txt:
        return None
    t = str(txt).strip().lower()
    try:
        m = re.search(r"(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)", t)
        if m:
            return date(int(m[1]), int(m[2]), int(m[3]))
        m = re.search(r"(?<!\d)(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})(?!\d)", t)
        if m:
            ano = int(m[3])
            ano += 2000 if ano < 100 else 0
            return date(ano, int(m[2]), int(m[1]))
        m = re.search(r"(\d{1,2})\s*(?:de\s+)?([a-zçã]{3,9})\.?\s*(?:de\s+)?(\d{4})", t)
        if m:
            mes = MESES.get(_sem_acento(m[2])[:3])
            if mes:
                return date(int(m[3]), mes, int(m[1]))
    except ValueError:
        return None
    return None


# ---------------------------------------------------------------------- extrato
def _sinal_por_saldo(valor, saldo, saldo_anterior):
    """Se o valor vem sem sinal, descobre entrada/saída pela variação do saldo."""
    if valor is None:
        return None
    if saldo is not None and saldo_anterior is not None:
        delta = round(saldo - saldo_anterior, 2)
        if abs(abs(delta) - abs(valor)) < 0.011:
            return abs(valor) if delta > 0 else -abs(valor)
    return valor


def parse_extrato_tabela(tabela) -> list[dict]:
    """
    Lê uma tabela de extrato (lista de linhas). Reconhece colunas de Data,
    Descrição/Histórico, Entrada/Crédito, Saída/Débito, Valor e Saldo.
    Retorna [{"data", "descricao", "valor"}] — valor positivo = entrada,
    negativo = saída. Linhas sem movimentação (ex.: "— —") são ignoradas.
    """
    if not tabela or len(tabela) < 2:
        return []

    idx_cab = None
    for i, linha in enumerate(tabela[:3]):
        cab = [_sem_acento(str(c or "")) for c in linha]
        tem_data = any(c.startswith("data") for c in cab)
        tem_valor = any(k in c for c in cab for k in ("entrada", "saida", "credito", "debito", "valor"))
        if tem_data and tem_valor:
            idx_cab = i
            break
    if idx_cab is None:
        return []

    cab = [_sem_acento(str(c or "")) for c in tabela[idx_cab]]

    def achar(*chaves):
        for i, c in enumerate(cab):
            if any(k in c for k in chaves):
                return i
        return None

    i_data = achar("data")
    i_ent = achar("entrada", "credito")
    i_sai = achar("saida", "debito")
    i_val = achar("valor") if (i_ent is None and i_sai is None) else None
    i_saldo = achar("saldo")
    i_desc = achar("descri", "histor", "lancamento")
    if i_desc is None and i_data is not None and i_data + 1 < len(cab):
        i_desc = i_data + 1

    def cel(linha, i):
        if i is None or i >= len(linha) or linha[i] is None:
            return ""
        return str(linha[i]).strip()

    movimentos, saldo_ant = [], None
    for linha in tabela[idx_cab + 1:]:
        d = parse_data(cel(linha, i_data))
        if d is None:
            continue
        saldo = parse_dinheiro(cel(linha, i_saldo)) if i_saldo is not None else None

        valor = None
        if i_ent is not None or i_sai is not None:
            ent = parse_dinheiro(cel(linha, i_ent)) if i_ent is not None else None
            sai = parse_dinheiro(cel(linha, i_sai)) if i_sai is not None else None
            if ent:
                valor = abs(ent)
            elif sai:
                valor = -abs(sai)
        elif i_val is not None:
            valor = _sinal_por_saldo(parse_dinheiro(cel(linha, i_val)), saldo, saldo_ant)

        if saldo is not None:
            saldo_ant = saldo
        if valor:
            descricao = re.sub(r"\s+", " ", cel(linha, i_desc)).strip() or "(sem descrição)"
            movimentos.append({"data": d, "descricao": descricao, "valor": valor})
    return movimentos


def parse_extrato_texto(texto: str) -> list[dict]:
    """
    Fallback quando o PDF não tem tabela detectável. Cada linha começa com a
    data; no fim ficam as colunas numéricas: [entrada, saída, saldo] (traço
    "—" = vazio), [valor, saldo] ou só [valor].
    """
    movimentos, saldo_ant = [], None
    for linha in texto.splitlines():
        m = RE_DATA_INICIO_LINHA.match(linha)
        if not m:
            continue
        d = parse_data(m[1])
        if d is None:
            continue

        tokens = m[2].split()
        cauda = []
        while tokens and (RE_DINHEIRO_TOKEN.match(tokens[-1]) or eh_traco(tokens[-1]) or tokens[-1] == "R$"):
            t = tokens.pop()
            if t != "R$":
                cauda.insert(0, t)
        descricao = re.sub(r"\s+", " ", " ".join(tokens)).strip(" -—–|")
        valores = [parse_dinheiro(t) for t in cauda]

        valor, saldo = None, None
        if len(cauda) >= 3:
            ent, sai, saldo = valores[-3], valores[-2], valores[-1]
            valor = abs(ent) if ent else (-abs(sai) if sai else None)
        elif len(cauda) == 2:
            saldo = valores[1]
            valor = _sinal_por_saldo(valores[0], saldo, saldo_ant)
        elif len(cauda) == 1:
            valor = valores[0]

        if saldo is not None:
            saldo_ant = saldo
        if valor:
            movimentos.append({"data": d, "descricao": descricao or "(sem descrição)", "valor": valor})
    return movimentos


def gerar_fitid(empresa_id: str, data: date, descricao: str, valor: float, ocorrencia: int) -> str:
    """ID sintético e estável (PDF não tem fitid). `ocorrencia` separa lançamentos idênticos no mesmo dia."""
    desc = re.sub(r"\s+", " ", descricao).strip().upper()
    base = f"{empresa_id}|{data.isoformat()}|{desc}|{valor:.2f}|{ocorrencia}"
    return "PDF-" + hashlib.sha256(base.encode("utf-8")).hexdigest()[:24]


# ------------------------------------------------------------------ comprovantes
_ROTULO_VALOR = re.compile(
    r"(?i)\b(valor(?:\s+total|\s+pago|\s+do\s+documento|\s+a\s+pagar|\s+cobrado)?"
    r"|total(?:\s+a\s+pagar|\s+geral|\s+pago)?|vlr\.?(?:\s+total)?)\b[^\d\n]{0,25}?(" + _DINHEIRO + ")"
)


def extrair_valor(texto: str) -> float | None:
    totais, valores = [], []
    for m in _ROTULO_VALOR.finditer(texto):
        v = parse_dinheiro(m[2])
        if v is None:
            continue
        (totais if "total" in m[1].lower() else valores).append(abs(v))
    if totais:
        return totais[-1]
    if valores:
        return valores[0]
    todos = [abs(v) for v in (parse_dinheiro(x) for x in RE_DINHEIRO.findall(texto)) if v]
    return max(todos) if todos else None


def extrair_data(texto: str) -> date | None:
    for linha in texto.splitlines():
        if re.search(r"(?i)\b(data|emiss[aã]o|emitido|pago em)\b", linha):
            m = RE_DATA_ANY.search(linha)
            if m and (d := parse_data(m.group())):
                return d
    for m in RE_DATA_ANY.finditer(texto):
        if d := parse_data(m.group()):
            return d
    return None


def extrair_cnpj_cpf(texto: str) -> str | None:
    if m := RE_CNPJ.search(texto):
        return m.group()
    if m := re.search(r"(?i)cnpj\D{0,6}(\d{14})(?!\d)", texto):
        n = m[1]
        return f"{n[:2]}.{n[2:5]}.{n[5:8]}/{n[8:12]}-{n[12:]}"
    if m := RE_CPF.search(texto):
        return m.group()
    return None


def extrair_descricao(bloco: str) -> str | None:
    if m := re.search(r"(?im)^\s*descri[cç][aã]o\s*:\s*(.+?)\s*$", bloco):
        return m[1][:255]
    for linha in bloco.splitlines():
        if linha.strip():
            return linha.strip()[:255]
    return None


def inferir_tipo(bloco: str) -> str:
    if re.search(r"(?i)boleto|linha\s+digit[aá]vel|c[oó]digo\s+de\s+barras", bloco):
        return "BOLETO"
    if re.search(r"(?i)nota\s+fiscal|\bnf-?e\b|\bnfs-?e\b|danfe", bloco):
        return "NOTA_FISCAL"
    return "RECIBO"


def dividir_em_comprovantes(texto: str) -> list[str]:
    """
    Um PDF pode trazer vários comprovantes. Cada um começa na linha-título que
    antecede um rótulo "Data:". Com menos de 2 rótulos, devolve o texto inteiro.
    """
    linhas = texto.splitlines()
    pos = [i for i, l in enumerate(linhas) if re.match(r"(?i)^\s*data(?:\s+de\s+emiss[aã]o)?\s*:", l)]
    if len(pos) < 2:
        return [texto]

    inicios = []
    for i in pos:
        anterior = linhas[i - 1] if i > 0 else ""
        inicios.append(i - 1 if anterior.strip() and ":" not in anterior else i)

    return [
        "\n".join(linhas[ini: inicios[k + 1] if k + 1 < len(inicios) else len(linhas)])
        for k, ini in enumerate(inicios)
    ]
