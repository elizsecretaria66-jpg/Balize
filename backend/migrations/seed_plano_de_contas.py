"""
Seed: Plano de Contas padrão de Gestão Financeira + regras de categorização
básicas de exemplo.

Uso:
    python -m migrations.seed_plano_de_contas <empresa_id>

Idempotente: usa `codigo` (único por empresa) para não duplicar em reexecuções.
"""

import sys

from app.database import SessionLocal
from app.models import PlanoDeContas, RegraCategorizacao, TipoPlanoContas

PLANO_PADRAO = [
    # codigo, nome_categoria, tipo
    ("1.1", "Vendas de Produtos", TipoPlanoContas.RECEITA),
    ("1.2", "Prestação de Serviços", TipoPlanoContas.RECEITA),
    ("1.3", "Outras Receitas Operacionais", TipoPlanoContas.RECEITA),
    ("1.4", "Receitas Financeiras", TipoPlanoContas.RECEITA),
    ("2.1", "Fornecedores", TipoPlanoContas.DESPESA),
    ("2.2", "Salários e Encargos", TipoPlanoContas.DESPESA),
    ("2.3", "Aluguel e Condomínio", TipoPlanoContas.DESPESA),
    ("2.4", "Impostos e Taxas", TipoPlanoContas.DESPESA),
    ("2.5", "Marketing e Publicidade", TipoPlanoContas.DESPESA),
    ("2.6", "Transporte e Logística", TipoPlanoContas.DESPESA),
    ("2.7", "Utilidades (Água, Luz, Internet)", TipoPlanoContas.DESPESA),
    ("2.8", "Tarifas e Despesas Bancárias", TipoPlanoContas.DESPESA),
    ("2.9", "Software e Assinaturas", TipoPlanoContas.DESPESA),
    ("2.10", "Despesas Administrativas Gerais", TipoPlanoContas.DESPESA),
    ("3.1", "Transferência Entre Contas Próprias", TipoPlanoContas.TRANSFERENCIA),
    ("3.2", "Aporte de Sócios", TipoPlanoContas.TRANSFERENCIA),
    ("3.3", "Distribuição de Lucros", TipoPlanoContas.TRANSFERENCIA),
]

# Exemplos de regras automáticas (palavra-chave -> código da categoria acima)
REGRAS_PADRAO = [
    ("UBER", "2.6"),
    ("99APP", "2.6"),
    ("POSTO", "2.6"),
    ("IFOOD", "2.10"),
    ("AWS", "2.9"),
    ("GOOGLE CLOUD", "2.9"),
    ("FOLHA DE PAGAMENTO", "2.2"),
    ("ALUGUEL", "2.3"),
    ("TARIFA", "2.8"),
    ("IOF", "2.4"),
    ("DARF", "2.4"),
]


def seed(empresa_id: str) -> None:
    db = SessionLocal()
    try:
        codigo_para_categoria: dict[str, PlanoDeContas] = {}

        for codigo, nome, tipo in PLANO_PADRAO:
            existente = (
                db.query(PlanoDeContas)
                .filter_by(empresa_id=empresa_id, codigo=codigo)
                .first()
            )
            if existente:
                codigo_para_categoria[codigo] = existente
                continue

            categoria = PlanoDeContas(
                empresa_id=empresa_id, codigo=codigo, nome_categoria=nome, tipo=tipo
            )
            db.add(categoria)
            db.flush()  # garante categoria.id disponível para as regras
            codigo_para_categoria[codigo] = categoria

        for palavra_chave, codigo in REGRAS_PADRAO:
            categoria = codigo_para_categoria.get(codigo)
            if not categoria:
                continue

            ja_existe = (
                db.query(RegraCategorizacao)
                .filter_by(empresa_id=empresa_id, palavra_chave=palavra_chave)
                .first()
            )
            if ja_existe:
                continue

            db.add(
                RegraCategorizacao(
                    empresa_id=empresa_id,
                    palavra_chave=palavra_chave,
                    categoria_id_fk=categoria.id,
                )
            )

        db.commit()
        print(f"Plano de Contas e regras padrão aplicados à empresa {empresa_id}.")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python -m migrations.seed_plano_de_contas <empresa_id>")
        sys.exit(1)
    seed(sys.argv[1])
