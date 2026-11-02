from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models import (
    StatusConciliacao,
    StatusProcessamento,
    TipoDocumento,
    TipoTransacao,
)


class TransacaoBancariaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    data: date
    descricao_extrato: str
    valor: float
    tipo: TipoTransacao
    status_conciliacao: StatusConciliacao
    documento_id_fk: str | None
    categoria_id: str | None


class DocumentoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    url_arquivo_local: str
    data_emissao: date | None
    valor_total: float | None
    cnpj_emissor: str | None
    status_processamento: StatusProcessamento
    tipo_doc: TipoDocumento
    descricao: str | None = None


class UploadExtratoResponse(BaseModel):
    processados: int
    duplicados_ignorados: int
    erros: list[str] = []


class UploadComprovanteResponse(BaseModel):
    lidos: int
    duplicados_ignorados: int
    erros: list[str] = []
    documentos: list[DocumentoOut] = []


class ConciliacaoResultado(BaseModel):
    conciliados: int
    sugestoes: int
    categorizados_automaticamente: int
    sem_match: int
    detalhes: dict[str, list[str]]
