-- Migration: Índices de Desempenho (Rodada E)
-- Sequence timestamp posterior a 20260923121000
-- Idempotente com CREATE INDEX IF NOT EXISTS

-- 1. Índices compostos (empresa_id, coluna_de_data) para filtros temporais por empresa
CREATE INDEX IF NOT EXISTS idx_vendas_empresa_created_at
  ON public.vendas (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pedidos_empresa_created_at
  ON public.pedidos (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compras_empresa_data_compra
  ON public.compras (empresa_id, data_compra DESC);

CREATE INDEX IF NOT EXISTS idx_compras_empresa_created_at
  ON public.compras (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_empresa_created_at
  ON public.movimentacoes_estoque (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_vencimento
  ON public.contas_pagar (empresa_id, vencimento ASC);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_created_at
  ON public.contas_pagar (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa_vencimento
  ON public.contas_receber (empresa_id, vencimento ASC);

CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa_created_at
  ON public.contas_receber (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comissoes_empresa_created_at
  ON public.comissoes (empresa_id, created_at DESC);

-- 2. Índices de Chaves Estrangeiras mais usadas nas consultas do sistema
-- (venda_id, pedido_id, compra_id, produto_id, cliente_id, vendedor_id)

-- Itens de Venda
CREATE INDEX IF NOT EXISTS idx_itens_venda_venda_id
  ON public.itens_venda (venda_id);

CREATE INDEX IF NOT EXISTS idx_itens_venda_produto_id
  ON public.itens_venda (produto_id);

CREATE INDEX IF NOT EXISTS idx_itens_venda_empresa_venda
  ON public.itens_venda (empresa_id, venda_id);

-- Itens de Pedido
CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido_id
  ON public.itens_pedido (pedido_id);

CREATE INDEX IF NOT EXISTS idx_itens_pedido_produto_id
  ON public.itens_pedido (produto_id);

CREATE INDEX IF NOT EXISTS idx_itens_pedido_empresa_pedido
  ON public.itens_pedido (empresa_id, pedido_id);

-- Itens de Compra
CREATE INDEX IF NOT EXISTS idx_itens_compra_produto_id
  ON public.itens_compra (produto_id);

-- Pedidos (cliente_id e vendedor_id)
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id
  ON public.pedidos (cliente_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor_id
  ON public.pedidos (vendedor_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_empresa_cliente
  ON public.pedidos (empresa_id, cliente_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_empresa_vendedor
  ON public.pedidos (empresa_id, vendedor_id);

-- Vendas (cliente_id e vendedor_id já possuem idx_vendas_cliente e idx_vendas_vendedor, adicionamos compostos com empresa_id)
CREATE INDEX IF NOT EXISTS idx_vendas_empresa_cliente
  ON public.vendas (empresa_id, cliente_id);

CREATE INDEX IF NOT EXISTS idx_vendas_empresa_vendedor
  ON public.vendas (empresa_id, vendedor_id);

-- Contas a Receber (venda_id, cliente_id)
CREATE INDEX IF NOT EXISTS idx_contas_receber_venda_id
  ON public.contas_receber (venda_id);

CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_id
  ON public.contas_receber (cliente_id);

CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa_status
  ON public.contas_receber (empresa_id, status);

-- Contas a Pagar (fornecedor_id, status)
CREATE INDEX IF NOT EXISTS idx_contas_pagar_fornecedor_id
  ON public.contas_pagar (fornecedor_id);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_status
  ON public.contas_pagar (empresa_id, status);

-- Comissões (venda_id, vendedor_id, status)
CREATE INDEX IF NOT EXISTS idx_comissoes_venda_id
  ON public.comissoes (venda_id);

CREATE INDEX IF NOT EXISTS idx_comissoes_vendedor_id
  ON public.comissoes (vendedor_id);

CREATE INDEX IF NOT EXISTS idx_comissoes_empresa_status
  ON public.comissoes (empresa_id, status);

-- Movimentações de Estoque (produto_id, referencia_id)
CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto_id
  ON public.movimentacoes_estoque (produto_id);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_empresa_produto
  ON public.movimentacoes_estoque (empresa_id, produto_id);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_referencia_id
  ON public.movimentacoes_estoque (referencia_id);
