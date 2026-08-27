// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.17'
  }
  public: {
    Tables: {
      assinaturas: {
        Row: {
          cancelada_em: string | null
          created_at: string
          empresa_id: string
          fim_periodo_teste: string | null
          gateway: string | null
          gateway_subscription_id: string | null
          id: string
          inicio: string
          metodo_pagamento: string | null
          plano_id: string
          proxima_cobranca: string | null
          status: string
          ultimo_pagamento_id: string | null
          updated_at: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          cancelada_em?: string | null
          created_at?: string
          empresa_id: string
          fim_periodo_teste?: string | null
          gateway?: string | null
          gateway_subscription_id?: string | null
          id?: string
          inicio: string
          metodo_pagamento?: string | null
          plano_id: string
          proxima_cobranca?: string | null
          status?: string
          ultimo_pagamento_id?: string | null
          updated_at?: string
          valor: number
          vencimento?: string | null
        }
        Update: {
          cancelada_em?: string | null
          created_at?: string
          empresa_id?: string
          fim_periodo_teste?: string | null
          gateway?: string | null
          gateway_subscription_id?: string | null
          id?: string
          inicio?: string
          metodo_pagamento?: string | null
          plano_id?: string
          proxima_cobranca?: string | null
          status?: string
          ultimo_pagamento_id?: string | null
          updated_at?: string
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'assinaturas_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: true
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assinaturas_plano_id_fkey'
            columns: ['plano_id']
            isOneToOne: false
            referencedRelation: 'planos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assinaturas_ultimo_pagamento_id_fkey'
            columns: ['ultimo_pagamento_id']
            isOneToOne: false
            referencedRelation: 'transacoes'
            referencedColumns: ['id']
          },
        ]
      }
      categorias: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: 'categorias_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          created_at: string
          documento: string | null
          email: string | null
          empresa_id: string
          endereco: string | null
          estado: string | null
          id: string
          limite_credito: number
          nome: string
          numero: string | null
          observacoes: string | null
          telefone: string | null
          updated_at: string
          vendedor_id: string | null
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          empresa_id: string
          endereco?: string | null
          estado?: string | null
          id?: string
          limite_credito?: number
          nome: string
          numero?: string | null
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          vendedor_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          limite_credito?: number
          nome?: string
          numero?: string | null
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          vendedor_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'clientes_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clientes_vendedor_id_fkey'
            columns: ['vendedor_id']
            isOneToOne: false
            referencedRelation: 'vendedores'
            referencedColumns: ['id']
          },
        ]
      }
      comissoes: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          percentual: number
          status: string
          valor_comissao: number
          valor_venda: number
          venda_id: string
          vendedor_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          percentual?: number
          status?: string
          valor_comissao?: number
          valor_venda?: number
          venda_id: string
          vendedor_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          percentual?: number
          status?: string
          valor_comissao?: number
          valor_venda?: number
          venda_id?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comissoes_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comissoes_venda_id_fkey'
            columns: ['venda_id']
            isOneToOne: false
            referencedRelation: 'vendas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comissoes_vendedor_id_fkey'
            columns: ['vendedor_id']
            isOneToOne: false
            referencedRelation: 'vendedores'
            referencedColumns: ['id']
          },
        ]
      }
      compras: {
        Row: {
          created_at: string | null
          created_by: string | null
          data_compra: string | null
          empresa_id: string
          forma_pagamento: string | null
          fornecedor_id: string
          id: string
          numero: number
          observacoes: string | null
          status: string
          total: number | null
          updated_at: string | null
          valor_pago: number | null
          vencimento: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data_compra?: string | null
          empresa_id: string
          forma_pagamento?: string | null
          fornecedor_id: string
          id?: string
          numero?: number
          observacoes?: string | null
          status?: string
          total?: number | null
          updated_at?: string | null
          valor_pago?: number | null
          vencimento?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data_compra?: string | null
          empresa_id?: string
          forma_pagamento?: string | null
          fornecedor_id?: string
          id?: string
          numero?: number
          observacoes?: string | null
          status?: string
          total?: number | null
          updated_at?: string | null
          valor_pago?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'compras_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'usuarios'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'compras_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'compras_fornecedor_id_fkey'
            columns: ['fornecedor_id']
            isOneToOne: false
            referencedRelation: 'fornecedores'
            referencedColumns: ['id']
          },
        ]
      }
      contas_pagar: {
        Row: {
          created_at: string
          data_pagamento: string | null
          descricao: string
          empresa_id: string
          fornecedor_id: string | null
          id: string
          status: string
          updated_at: string
          valor: number
          valor_pago: number
          vencimento: string
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          descricao: string
          empresa_id: string
          fornecedor_id?: string | null
          id?: string
          status?: string
          updated_at?: string
          valor: number
          valor_pago?: number
          vencimento: string
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          descricao?: string
          empresa_id?: string
          fornecedor_id?: string | null
          id?: string
          status?: string
          updated_at?: string
          valor?: number
          valor_pago?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contas_pagar_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contas_pagar_fornecedor_id_fkey'
            columns: ['fornecedor_id']
            isOneToOne: false
            referencedRelation: 'fornecedores'
            referencedColumns: ['id']
          },
        ]
      }
      contas_receber: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_pagamento: string | null
          descricao: string
          empresa_id: string
          id: string
          status: string
          updated_at: string
          valor: number
          valor_pago: number
          vencimento: string
          venda_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          descricao: string
          empresa_id: string
          id?: string
          status?: string
          updated_at?: string
          valor: number
          valor_pago?: number
          vencimento: string
          venda_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          descricao?: string
          empresa_id?: string
          id?: string
          status?: string
          updated_at?: string
          valor?: number
          valor_pago?: number
          vencimento?: string
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'contas_receber_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contas_receber_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contas_receber_venda_id_fkey'
            columns: ['venda_id']
            isOneToOne: false
            referencedRelation: 'vendas'
            referencedColumns: ['id']
          },
        ]
      }
      empresas: {
        Row: {
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          nome: string
          nome_fantasia: string | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          nome_fantasia?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          nome_fantasia?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      estoques: {
        Row: {
          empresa_id: string
          id: string
          produto_id: string
          quantidade: number
          updated_at: string
        }
        Insert: {
          empresa_id: string
          id?: string
          produto_id: string
          quantidade?: number
          updated_at?: string
        }
        Update: {
          empresa_id?: string
          id?: string
          produto_id?: string
          quantidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'estoques_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'estoques_produto_id_fkey'
            columns: ['produto_id']
            isOneToOne: false
            referencedRelation: 'produtos'
            referencedColumns: ['id']
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cidade: string | null
          created_at: string
          documento: string | null
          email: string | null
          empresa_id: string
          estado: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          empresa_id: string
          estado?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          empresa_id?: string
          estado?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fornecedores_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
        ]
      }
      itens_compra: {
        Row: {
          compra_id: string
          empresa_id: string
          id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Insert: {
          compra_id: string
          empresa_id: string
          id?: string
          preco_unitario?: number
          produto_id: string
          quantidade: number
          subtotal?: number
        }
        Update: {
          compra_id?: string
          empresa_id?: string
          id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: 'itens_compra_compra_id_fkey'
            columns: ['compra_id']
            isOneToOne: false
            referencedRelation: 'compras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'itens_compra_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'itens_compra_produto_id_fkey'
            columns: ['produto_id']
            isOneToOne: false
            referencedRelation: 'produtos'
            referencedColumns: ['id']
          },
        ]
      }
      itens_pedido: {
        Row: {
          desconto: number
          empresa_id: string
          id: string
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Insert: {
          desconto?: number
          empresa_id: string
          id?: string
          pedido_id: string
          preco_unitario?: number
          produto_id: string
          quantidade: number
          subtotal?: number
        }
        Update: {
          desconto?: number
          empresa_id?: string
          id?: string
          pedido_id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: 'itens_pedido_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'itens_pedido_pedido_id_fkey'
            columns: ['pedido_id']
            isOneToOne: false
            referencedRelation: 'pedidos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'itens_pedido_produto_id_fkey'
            columns: ['produto_id']
            isOneToOne: false
            referencedRelation: 'produtos'
            referencedColumns: ['id']
          },
        ]
      }
      itens_venda: {
        Row: {
          custo_unitario: number
          desconto: number
          empresa_id: string
          id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Insert: {
          custo_unitario?: number
          desconto?: number
          empresa_id: string
          id?: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal?: number
          venda_id: string
        }
        Update: {
          custo_unitario?: number
          desconto?: number
          empresa_id?: string
          id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'itens_venda_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'itens_venda_produto_id_fkey'
            columns: ['produto_id']
            isOneToOne: false
            referencedRelation: 'produtos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'itens_venda_venda_id_fkey'
            columns: ['venda_id']
            isOneToOne: false
            referencedRelation: 'vendas'
            referencedColumns: ['id']
          },
        ]
      }
      log_assinaturas: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          plano_anterior_id: string | null
          plano_novo_id: string | null
          tipo: string
          usuario_responsavel_id: string | null
          valor_anterior: number | null
          valor_novo: number | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          plano_anterior_id?: string | null
          plano_novo_id?: string | null
          tipo: string
          usuario_responsavel_id?: string | null
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          plano_anterior_id?: string | null
          plano_novo_id?: string | null
          tipo?: string
          usuario_responsavel_id?: string | null
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'log_assinaturas_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'log_assinaturas_plano_anterior_id_fkey'
            columns: ['plano_anterior_id']
            isOneToOne: false
            referencedRelation: 'planos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'log_assinaturas_plano_novo_id_fkey'
            columns: ['plano_novo_id']
            isOneToOne: false
            referencedRelation: 'planos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'log_assinaturas_usuario_responsavel_id_fkey'
            columns: ['usuario_responsavel_id']
            isOneToOne: false
            referencedRelation: 'usuarios'
            referencedColumns: ['id']
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          empresa_id: string
          fornecedor_id: string | null
          id: string
          motivo: string | null
          produto_id: string
          quantidade: number
          referencia_id: string | null
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          fornecedor_id?: string | null
          id?: string
          motivo?: string | null
          produto_id: string
          quantidade: number
          referencia_id?: string | null
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          fornecedor_id?: string | null
          id?: string
          motivo?: string | null
          produto_id?: string
          quantidade?: number
          referencia_id?: string | null
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_movimentacoes_fornecedor'
            columns: ['fornecedor_id']
            isOneToOne: false
            referencedRelation: 'fornecedores'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movimentacoes_estoque_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movimentacoes_estoque_produto_id_fkey'
            columns: ['produto_id']
            isOneToOne: false
            referencedRelation: 'produtos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movimentacoes_estoque_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'usuarios'
            referencedColumns: ['id']
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string | null
          created_at: string
          empresa_id: string
          id: string
          numero: number
          observacoes: string | null
          status: string
          total: number
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          numero?: number
          observacoes?: string | null
          status?: string
          total?: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          numero?: number
          observacoes?: string | null
          status?: string
          total?: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'pedidos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pedidos_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pedidos_vendedor_id_fkey'
            columns: ['vendedor_id']
            isOneToOne: false
            referencedRelation: 'vendedores'
            referencedColumns: ['id']
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          limite_clientes: number | null
          limite_produtos: number | null
          limite_usuarios: number | null
          limite_vendas_mes: number | null
          limite_vendedores: number | null
          nome: string
          ordem: number | null
          periodo_teste_dias: number | null
          recursos: Json | null
          slug: string | null
          updated_at: string | null
          valor_mensal: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          limite_clientes?: number | null
          limite_produtos?: number | null
          limite_usuarios?: number | null
          limite_vendas_mes?: number | null
          limite_vendedores?: number | null
          nome: string
          ordem?: number | null
          periodo_teste_dias?: number | null
          recursos?: Json | null
          slug?: string | null
          updated_at?: string | null
          valor_mensal: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          limite_clientes?: number | null
          limite_produtos?: number | null
          limite_usuarios?: number | null
          limite_vendas_mes?: number | null
          limite_vendedores?: number | null
          nome?: string
          ordem?: number | null
          periodo_teste_dias?: number | null
          recursos?: Json | null
          slug?: string | null
          updated_at?: string | null
          valor_mensal?: number
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          codigo: string | null
          codigo_barras: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          estoque_minimo: number
          fornecedor_id: string | null
          foto_url: string | null
          id: string
          nome: string
          preco_custo: number
          preco_venda: number
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          codigo?: string | null
          codigo_barras?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          estoque_minimo?: number
          fornecedor_id?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          preco_custo?: number
          preco_venda?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          codigo?: string | null
          codigo_barras?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          estoque_minimo?: number
          fornecedor_id?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          preco_custo?: number
          preco_venda?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'produtos_categoria_id_fkey'
            columns: ['categoria_id']
            isOneToOne: false
            referencedRelation: 'categorias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'produtos_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'produtos_fornecedor_id_fkey'
            columns: ['fornecedor_id']
            isOneToOne: false
            referencedRelation: 'fornecedores'
            referencedColumns: ['id']
          },
        ]
      }
      transacoes: {
        Row: {
          assinatura_id: string | null
          created_at: string | null
          empresa_id: string
          external_reference: string | null
          gateway: string
          gateway_id: string | null
          gateway_status: string | null
          id: string
          metadata: Json | null
          metodo_pagamento: string | null
          plano_id: string | null
          status: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          assinatura_id?: string | null
          created_at?: string | null
          empresa_id: string
          external_reference?: string | null
          gateway?: string
          gateway_id?: string | null
          gateway_status?: string | null
          id?: string
          metadata?: Json | null
          metodo_pagamento?: string | null
          plano_id?: string | null
          status?: string
          updated_at?: string | null
          valor: number
        }
        Update: {
          assinatura_id?: string | null
          created_at?: string | null
          empresa_id?: string
          external_reference?: string | null
          gateway?: string
          gateway_id?: string | null
          gateway_status?: string | null
          id?: string
          metadata?: Json | null
          metodo_pagamento?: string | null
          plano_id?: string | null
          status?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: 'transacoes_assinatura_id_fkey'
            columns: ['assinatura_id']
            isOneToOne: false
            referencedRelation: 'assinaturas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transacoes_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transacoes_plano_id_fkey'
            columns: ['plano_id']
            isOneToOne: false
            referencedRelation: 'planos'
            referencedColumns: ['id']
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean
          auth_user_id: string
          created_at: string
          email: string
          empresa_id: string | null
          id: string
          nome: string
          perfil: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          auth_user_id: string
          created_at?: string
          email: string
          empresa_id?: string | null
          id?: string
          nome: string
          perfil?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          auth_user_id?: string
          created_at?: string
          email?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          perfil?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'usuarios_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
        ]
      }
      vendas: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          desconto: number
          empresa_id: string
          forma_pagamento: string | null
          id: string
          numero: number
          observacoes: string | null
          pedido_id: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          desconto?: number
          empresa_id: string
          forma_pagamento?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          pedido_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          desconto?: number
          empresa_id?: string
          forma_pagamento?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          pedido_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'vendas_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendas_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'usuarios'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendas_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendas_pedido_id_fkey'
            columns: ['pedido_id']
            isOneToOne: false
            referencedRelation: 'pedidos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendas_vendedor_id_fkey'
            columns: ['vendedor_id']
            isOneToOne: false
            referencedRelation: 'vendedores'
            referencedColumns: ['id']
          },
        ]
      }
      vendedores: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nome: string
          percentual_comissao: number
          usuario_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          percentual_comissao?: number
          usuario_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          percentual_comissao?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'vendedores_empresa_id_fkey'
            columns: ['empresa_id']
            isOneToOne: false
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendedores_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'usuarios'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      alterar_plano: { Args: { p_novo_plano_slug: string }; Returns: Json }
      alterar_plano_admin: {
        Args: { p_empresa_id: string; p_novo_plano_slug: string }
        Returns: Json
      }
      alterar_status_cliente: {
        Args: { p_ativo: boolean; p_cliente_id: string }
        Returns: Json
      }
      alterar_status_produto: {
        Args: { p_ativo: boolean; p_produto_id: string }
        Returns: Json
      }
      alterar_status_usuario: {
        Args: { p_ativo: boolean; p_usuario_id: string }
        Returns: Json
      }
      alterar_status_vendedor: {
        Args: { p_ativo: boolean; p_vendedor_id: string }
        Returns: Json
      }
      bloquear_empresa: { Args: { p_empresa_id: string }; Returns: Json }
      cancelar_assinatura: { Args: never; Returns: Json }
      confirmar_compra: { Args: { p_compra_id: string }; Returns: Json }
      converter_pedido_em_venda: {
        Args: {
          p_forma_pagamento?: string
          p_pedido_id: string
          p_vencimento?: string
        }
        Returns: Json
      }
      criar_checkout: { Args: { p_plano_slug: string }; Returns: Json }
      criar_cliente: {
        Args: {
          p_bairro?: string
          p_cep?: string
          p_cidade?: string
          p_documento?: string
          p_email?: string
          p_endereco?: string
          p_estado?: string
          p_limite_credito?: number
          p_nome: string
          p_numero?: string
          p_observacoes?: string
          p_telefone?: string
          p_vendedor_id?: string
          p_whatsapp?: string
        }
        Returns: Json
      }
      criar_compra: {
        Args: {
          p_data_compra?: string
          p_forma_pagamento?: string
          p_fornecedor_id: string
          p_itens: Json
          p_observacoes?: string
          p_valor_pago?: number
          p_vencimento?: string
        }
        Returns: Json
      }
      criar_pedido: {
        Args: {
          p_cliente_id?: string
          p_itens?: Json
          p_observacoes?: string
          p_vendedor_id?: string
        }
        Returns: Json
      }
      criar_plano_admin: {
        Args: {
          p_ativo: boolean
          p_descricao: string
          p_limite_clientes: number
          p_limite_produtos: number
          p_limite_usuarios: number
          p_limite_vendas_mes: number
          p_limite_vendedores: number
          p_nome: string
          p_ordem: number
          p_periodo_teste_dias: number
          p_recursos: Json
          p_slug: string
          p_valor_mensal: number
        }
        Returns: Json
      }
      criar_produto: {
        Args: {
          p_categoria_id?: string
          p_codigo?: string
          p_descricao?: string
          p_estoque_inicial?: number
          p_estoque_minimo?: number
          p_fornecedor_id?: string
          p_nome: string
          p_preco_custo?: number
          p_preco_venda?: number
          p_unidade?: string
        }
        Returns: Json
      }
      criar_vendedor: {
        Args: {
          p_nome?: string
          p_percentual_comissao?: number
          p_usuario_id?: string
        }
        Returns: Json
      }
      desbloquear_empresa: { Args: { p_empresa_id: string }; Returns: Json }
      editar_plano_admin: {
        Args: {
          p_ativo: boolean
          p_descricao: string
          p_limite_clientes: number
          p_limite_produtos: number
          p_limite_usuarios: number
          p_limite_vendas_mes: number
          p_limite_vendedores: number
          p_nome: string
          p_ordem: number
          p_periodo_teste_dias: number
          p_plano_id: string
          p_recursos: Json
          p_slug: string
          p_valor_mensal: number
        }
        Returns: Json
      }
      finalizar_venda: {
        Args: {
          p_cliente_id: string
          p_desconto?: number
          p_forma_pagamento?: string
          p_itens: Json
          p_observacoes?: string
          p_vencimento?: string
          p_vendedor_id: string
        }
        Returns: Json
      }
      get_admin_dashboard: { Args: never; Returns: Json }
      get_historico_financeiro_admin: { Args: never; Returns: Json }
      get_my_empresa_id: { Args: never; Returns: string }
      get_status_assinatura: { Args: never; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_manager_or_above: { Args: never; Returns: boolean }
      is_master: { Args: never; Returns: boolean }
      is_operador_or_above: { Args: never; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_vendedor_or_above: { Args: never; Returns: boolean }
      listar_empresas_admin: { Args: never; Returns: Json }
      listar_historico_admin: { Args: never; Returns: Json }
      listar_planos_admin: { Args: never; Returns: Json }
      reativar_assinatura: { Args: never; Returns: Json }
      registrar_entrada_estoque: {
        Args: { p_motivo?: string; p_produto_id: string; p_quantidade: number }
        Returns: Json
      }
      registrar_entrada_estoque_por_fornecedor: {
        Args: {
          p_fornecedor_id: string
          p_motivo?: string
          p_preco_custo: number
          p_produto_id: string
          p_quantidade: number
        }
        Returns: Json
      }
      registrar_pagamento: {
        Args: {
          p_conta_id: string
          p_data_pagamento?: string
          p_valor_pago: number
        }
        Returns: Json
      }
      registrar_recebimento: {
        Args: {
          p_conta_id: string
          p_data_pagamento?: string
          p_valor_recebido: number
        }
        Returns: Json
      }
      toggle_plano_ativo: {
        Args: { p_ativo: boolean; p_plano_id: string }
        Returns: Json
      }
      validar_limite_usuarios: { Args: { p_empresa_id: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
