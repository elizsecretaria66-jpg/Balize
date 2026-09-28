"""
Modelos SQLAlchemy 2.0 — schema do módulo de Conciliação Bancária.

Tabelas:
    Empresas, PlanoDeContas, TransacoesBancarias, Documentos, RegrasCategorizacao

Observações de design:
- `fitid_ofx` é único POR EMPRESA (UniqueConstraint composta empresa_id + fitid_ofx),
  não globalmente único — duas empresas diferentes podem, em teoria, ter o mesmo
  fitid gerado por bancos diferentes.
- `status_conciliacao` inclui o valor "SUGESTAO" além de PENDENTE/CONCILIADO,
  necessário para o motor de conciliação (match de 4 a 7 dias de diferença).
- `TransacoesBancarias.categoria_id` foi adicionado (não estava na lista original)
  para permitir tanto a categorização automática via RegrasCategorizacao quanto
  a categorização manual feita pelo usuário na tela.
"""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    Enum as SAEnum,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def gen_uuid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TipoPlanoContas(str, enum.Enum):
    RECEITA = "RECEITA"
    DESPESA = "DESPESA"
    TRANSFERENCIA = "TRANSFERENCIA"


class TipoTransacao(str, enum.Enum):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"


class StatusConciliacao(str, enum.Enum):
    PENDENTE = "PENDENTE"
    SUGESTAO = "SUGESTAO"
    CONCILIADO = "CONCILIADO"


class StatusProcessamento(str, enum.Enum):
    PENDENTE = "PENDENTE"
    PROCESSADO = "PROCESSADO"
    ERRO = "ERRO"


class TipoDocumento(str, enum.Enum):
    NOTA_FISCAL = "NOTA_FISCAL"
    RECIBO = "RECIBO"
    BOLETO = "BOLETO"


class TipoLancamento(str, enum.Enum):
    PAGAR = "PAGAR"
    RECEBER = "RECEBER"


class StatusLancamento(str, enum.Enum):
    PENDENTE = "PENDENTE"
    PAGO = "PAGO"


# ---------------------------------------------------------------------------
# Tabelas
# ---------------------------------------------------------------------------

class Empresa(Base):
    __tablename__ = "Empresas"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    cnpj: Mapped[str] = mapped_column(String(18), nullable=False, unique=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plano_de_contas: Mapped[list["PlanoDeContas"]] = relationship(back_populates="empresa")
    transacoes: Mapped[list["TransacaoBancaria"]] = relationship(back_populates="empresa")
    documentos: Mapped[list["Documento"]] = relationship(back_populates="empresa")
    regras: Mapped[list["RegraCategorizacao"]] = relationship(back_populates="empresa")


class PlanoDeContas(Base):
    __tablename__ = "PlanoDeContas"
    __table_args__ = (
        UniqueConstraint("empresa_id", "codigo", name="uq_plano_contas_empresa_codigo"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    empresa_id: Mapped[str] = mapped_column(ForeignKey("Empresas.id", ondelete="CASCADE"), index=True)
    codigo: Mapped[str] = mapped_column(String(20), nullable=False)
    nome_categoria: Mapped[str] = mapped_column(String(120), nullable=False)
    tipo: Mapped[TipoPlanoContas] = mapped_column(SAEnum(TipoPlanoContas, name="tipo_plano_contas"))

    empresa: Mapped["Empresa"] = relationship(back_populates="plano_de_contas")


class Documento(Base):
    __tablename__ = "Documentos"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    empresa_id: Mapped[str] = mapped_column(ForeignKey("Empresas.id", ondelete="CASCADE"), index=True)
    url_arquivo_local: Mapped[str] = mapped_column(String(500), nullable=False)
    data_emissao: Mapped[date | None] = mapped_column(Date, nullable=True)
    valor_total: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    cnpj_emissor: Mapped[str | None] = mapped_column(String(18), nullable=True)
    status_processamento: Mapped[StatusProcessamento] = mapped_column(
        SAEnum(StatusProcessamento, name="status_processamento"),
        default=StatusProcessamento.PENDENTE,
    )
    tipo_doc: Mapped[TipoDocumento] = mapped_column(SAEnum(TipoDocumento, name="tipo_documento"))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    empresa: Mapped["Empresa"] = relationship(back_populates="documentos")
    transacoes: Mapped[list["TransacaoBancaria"]] = relationship(back_populates="documento")


class TransacaoBancaria(Base):
    __tablename__ = "TransacoesBancarias"
    __table_args__ = (
        UniqueConstraint("empresa_id", "fitid_ofx", name="uq_transacao_empresa_fitid"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    empresa_id: Mapped[str] = mapped_column(ForeignKey("Empresas.id", ondelete="CASCADE"), index=True)
    fitid_ofx: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    descricao_extrato: Mapped[str] = mapped_column(String(500), nullable=False)
    valor: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    tipo: Mapped[TipoTransacao] = mapped_column(SAEnum(TipoTransacao, name="tipo_transacao"))
    status_conciliacao: Mapped[StatusConciliacao] = mapped_column(
        SAEnum(StatusConciliacao, name="status_conciliacao"),
        default=StatusConciliacao.PENDENTE,
        index=True,
    )
    documento_id_fk: Mapped[str | None] = mapped_column(
        ForeignKey("Documentos.id", ondelete="SET NULL"), nullable=True
    )
    categoria_id: Mapped[str | None] = mapped_column(
        ForeignKey("PlanoDeContas.id", ondelete="SET NULL"), nullable=True
    )
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    empresa: Mapped["Empresa"] = relationship(back_populates="transacoes")
    documento: Mapped["Documento | None"] = relationship(back_populates="transacoes")
    categoria: Mapped["PlanoDeContas | None"] = relationship()


class RegraCategorizacao(Base):
    __tablename__ = "RegrasCategorizacao"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    empresa_id: Mapped[str] = mapped_column(ForeignKey("Empresas.id", ondelete="CASCADE"), index=True)
    palavra_chave: Mapped[str] = mapped_column(String(120), nullable=False)
    categoria_id_fk: Mapped[str] = mapped_column(ForeignKey("PlanoDeContas.id", ondelete="CASCADE"))

    empresa: Mapped["Empresa"] = relationship(back_populates="regras")
    categoria: Mapped["PlanoDeContas"] = relationship()


class LancamentoFinanceiro(Base):
    """Contas a pagar / a receber (fluxo de caixa operacional)."""

    __tablename__ = "LancamentosFinanceiros"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    empresa_id: Mapped[str] = mapped_column(ForeignKey("Empresas.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[TipoLancamento] = mapped_column(SAEnum(TipoLancamento, name="tipo_lancamento"))
    descricao: Mapped[str] = mapped_column(String(255), nullable=False)
    valor: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    data_vencimento: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    data_pagamento: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[StatusLancamento] = mapped_column(
        SAEnum(StatusLancamento, name="status_lancamento"), default=StatusLancamento.PENDENTE
    )
    categoria_id: Mapped[str | None] = mapped_column(
        ForeignKey("PlanoDeContas.id", ondelete="SET NULL"), nullable=True
    )
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
