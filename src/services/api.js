// Simple API client using fetch, with base URL and auth token
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function request(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const token = auth ? localStorage.getItem('access_token') : null;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      // Content-Type pode ser sobrescrito (ex.: form-urlencoded no login)
      'Content-Type': headers['Content-Type'] || 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body && headers['Content-Type'] === 'application/x-www-form-urlencoded'
      ? body
      : (body ? JSON.stringify(body) : undefined),
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data?.detail || data?.message || message;
    } catch {}
    throw new Error(message);
  }
  // try parse json else return null
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export const api = {
  // Backend espera OAuth2PasswordRequestForm: username, password (form-urlencoded)
  login: (usuario, senha) => request('/auth/login', {
    method: 'POST',
    body: new URLSearchParams({ username: usuario, password: senha }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    auth: false,
  }),
  // Produtos
  getProdutos: (q) => request(`/api/produtos/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createProduto: (payload) => request('/api/produtos/', { method: 'POST', body: payload }),
  updateProduto: (id, payload) => request(`/api/produtos/${id}`, { method: 'PUT', body: payload }),
  deleteProduto: (id) => request(`/api/produtos/${id}`, { method: 'DELETE' }),
  // Categorias
  getCategorias: () => request('/api/categorias/'),
  // Usuários
  getUsuarios: () => request('/api/usuarios/'),
  getUsuariosDesativados: () => request('/api/usuarios/desativados'),
  createUsuario: (payload) => request('/api/usuarios/', { method: 'POST', body: payload }),
  updateUsuario: (id, payload) => request(`/api/usuarios/${id}`, { method: 'PUT', body: payload }),
  activateUsuario: (id) => request(`/api/usuarios/${id}/ativar`, { method: 'PUT' }),
  deleteUsuario: (id) => request(`/api/usuarios/${id}`, { method: 'DELETE' }),
  // Clientes
  getClientes: (q) => request(`/api/clientes/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createCliente: (payload) => request('/api/clientes/', { method: 'POST', body: payload }),
  updateCliente: (id, payload) => request(`/api/clientes/${id}`, { method: 'PUT', body: payload }),
  deleteCliente: (id) => request(`/api/clientes/${id}`, { method: 'DELETE' }),
  // Vendas
  getVendas: () => request('/api/vendas/'),
  getVenda: (id) => request(`/api/vendas/id/${id}`),
  createVenda: (payload) => {
    const body = { ...payload }
    if (!body.created_at) {
      // Preservar timestamp de criação no backend
      body.created_at = new Date().toISOString()
    }
    return request('/api/vendas/', { method: 'POST', body })
  },
  updateVenda: (id, payload) => {
    const body = { ...payload }
    return request(`/api/vendas/${id}`, { method: 'PUT', body })
  },
  getVendasPeriodo: (data_inicio, data_fim, usuario_id, limit, offset = 0) => {
    const qs = new URLSearchParams()
    if (data_inicio) qs.set('data_inicio', data_inicio)
    if (data_fim) qs.set('data_fim', data_fim)
    if (usuario_id != null) qs.set('usuario_id', usuario_id)
    if (limit != null) qs.set('limit', limit)
    if (offset) qs.set('offset', offset)
    return request(`/api/vendas/periodo?${qs.toString()}`)
  },
  // Dívidas
  /**
   * Cria uma nova dívida no backend.
   * payload deve seguir o modelo DividaCreate:
   * {
   *   id_local?: number,
   *   cliente_id?: string (UUID),
   *   usuario_id?: string (UUID),
   *   observacao?: string,
   *   desconto_aplicado?: number,
   *   percentual_desconto?: number,
   *   itens: [{ produto_id: string (UUID), quantidade, preco_unitario, subtotal }]
   * }
   */
  createDivida: (payload) => request('/api/dividas/', { method: 'POST', body: payload }),

  /**
   * Lista dívidas abertas. Se clienteId (UUID) for informado, filtra por cliente.
   */
  getDividasAbertas: (clienteId) => {
    const qs = clienteId ? `?cliente_id=${encodeURIComponent(clienteId)}` : ''
    return request(`/api/dividas/abertas${qs}`)
  },

  /**
   * Registra pagamento de uma dívida existente.
   * dividaId: UUID da dívida no backend
   * payload: { valor: number, forma_pagamento: string, usuario_id?: string(UUID) }
   */
  pagarDivida: (dividaId, payload) => (
    request(`/api/dividas/${dividaId}/pagamentos`, { method: 'POST', body: payload })
  ),
  // Métricas
  getMetricasEstoque: () => request('/api/metricas/estoque'),

  // Configuração da empresa
  getEmpresaConfig: () => request('/api/config/empresa'),
  updateEmpresaConfig: (payload) => request('/api/config/empresa', { method: 'PUT', body: payload }),

  // Admin
  resetDadosOnline: () => request('/api/admin/reset-dados', { method: 'POST' }),

  // Abastecimentos
  getAbastecimentosHistorico: ({ data_inicial, data_final, usuario_id, produto_id, pagina = 1, limite = 50, ordenacao = 'created_at_desc' } = {}) => {
    const qs = new URLSearchParams()
    if (data_inicial) qs.set('data_inicial', data_inicial)
    if (data_final) qs.set('data_final', data_final)
    if (usuario_id) qs.set('usuario_id', usuario_id)
    if (produto_id) qs.set('produto_id', produto_id)
    if (pagina) qs.set('pagina', String(pagina))
    if (limite) qs.set('limite', String(limite))
    if (ordenacao) qs.set('ordenacao', ordenacao)
    return request(`/api/abastecimentos/historico?${qs.toString()}`)
  },
};

export default api;
