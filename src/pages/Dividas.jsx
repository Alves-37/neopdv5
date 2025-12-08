import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'

export default function Dividas() {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('') // filtro simples por cliente/observação
  const [showPayModal, setShowPayModal] = useState(false)
  const [selectedDivida, setSelectedDivida] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('dinheiro')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getDividas()
      const arr = Array.isArray(data) ? data : (data?.items || [])
      setTodos(arr)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Atualização automática: polling e refresh quando a aba volta ao foco
  useEffect(() => {
    const intervalId = setInterval(() => { load() }, 20000)
    const onFocus = () => load()
    const onVisibility = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Debounce do filtro
  const [debouncedQ, setDebouncedQ] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 250)
    return () => clearTimeout(id)
  }, [q])

  const fmtMT = (v) => {
    if (v === null || v === undefined) return '—'
    try {
      const num = new Intl.NumberFormat('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v))
      return `MT ${num}`
    } catch { return `${v}` }
  }

  const fmtData = (d) => {
    try {
      if (!d) return '—'
      let s = typeof d === 'string' ? d : String(d)
      const isISO = /^\d{4}-\d{2}-\d{2}T/.test(s)
      const hasTZ = /Z$|[+-]\d{2}:?\d{2}$/.test(s)
      if (isISO && !hasTZ) s = s + 'Z'
      const dt = new Date(s)
      const fmt = new Intl.DateTimeFormat('pt-MZ', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: 'Africa/Maputo',
      })
      return fmt.format(dt)
    } catch {
      return d || '—'
    }
  }

  const filtradas = useMemo(() => {
    if (!debouncedQ) return todos
    return todos.filter(d => {
      const clienteNome = (d.cliente_nome || '').toLowerCase()
      const obs = (d.observacao || '').toLowerCase()
      const status = (d.status || '').toLowerCase()
      return clienteNome.includes(debouncedQ) || obs.includes(debouncedQ) || status.includes(debouncedQ)
    })
  }, [todos, debouncedQ])

  const Skeleton = () => (
    <div className="card animate-pulse">
      <div className="h-4 w-40 bg-gray-200 rounded" />
      <div className="mt-3 h-5 w-28 bg-gray-200 rounded" />
    </div>
  )

  function openPayModal(divida) {
    const restante = Math.max(0, Number(divida.valor_total ?? 0) - Number(divida.valor_pago ?? 0))
    if (restante <= 0) return
    setSelectedDivida(divida)
    setPayAmount(String(restante.toFixed(2)))
    setPayMethod('dinheiro')
    setPayError('')
    setShowPayModal(true)
  }

  function closePayModal() {
    setShowPayModal(false)
    setSelectedDivida(null)
    setPayAmount('')
    setPayMethod('dinheiro')
    setPayError('')
  }

  async function submitPayment() {
    if (!selectedDivida) return
    setPayError('')
    const restante = Math.max(0, Number(selectedDivida.valor_total ?? 0) - Number(selectedDivida.valor_pago ?? 0))
    let valor = Number(payAmount)
    if (!isFinite(valor) || valor <= 0) {
      setPayError('Informe um valor válido (> 0).')
      return
    }
    if (valor > restante + 1e-6) {
      setPayError(`Valor não pode exceder o restante (${fmtMT(restante)}).`)
      return
    }
    setPaying(true)
    try {
      await api.pagarDivida(selectedDivida.id, {
        valor,
        forma_pagamento: payMethod,
        usuario_id: null,
      })
      await load()
      closePayModal()
    } catch (e) {
      setPayError(e.message || 'Falha ao registrar pagamento')
    } finally {
      setPaying(false)
    }
  }

  async function openDetail(divida) {
    setSelectedDivida({ ...divida, _loading: true, itens: [] })
    setShowDetailModal(true)
    try {
      const detail = await api.getDivida(divida.id)
      if (detail && detail.id === divida.id) {
        setSelectedDivida({ ...detail, _loading: false })
      } else if (detail) {
        setSelectedDivida({ ...divida, ...detail, _loading: false })
      } else {
        setSelectedDivida({ ...divida, _loading: false })
      }
    } catch (e) {
      setSelectedDivida(prev => ({ ...(prev || divida), _loading: false, _error: e.message || 'Falha ao carregar detalhes' }))
    }
  }

  function closeDetail() {
    setShowDetailModal(false)
    setSelectedDivida(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Dívidas</h1>
        <div className="flex-1 min-w-[220px] sm:min-w-[320px] max-w-xl">
          <label htmlFor="buscar" className="sr-only">Buscar</label>
          <div className="relative">
            <input
              id="buscar"
              className="input w-full pl-9"
              placeholder="Buscar por cliente, observação ou status"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
            </span>
          </div>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
        </div>
      )}

      {!loading && filtradas.length === 0 && (
        <div className="card text-center py-10">
          <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="h-6 w-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v14H3z"/><path d="M3 9h18"/></svg>
          </div>
          <p className="mt-3 text-gray-600">Nenhuma dívida encontrada.</p>
        </div>
      )}

      {!loading && filtradas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtradas.map((d) => {
            const restante = Number(d.valor_total ?? 0) - Number(d.valor_pago ?? 0)
            return (
              <div key={d.id || d.id_local} className="card card-hover flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate" title={d.observacao || 'Dívida'}>
                      Dívida {d.id_local != null ? `#${d.id_local}` : ''}
                    </h3>
                    <div className="text-xs sm:text-sm text-gray-500">Cliente: {d.cliente_nome || '—'}</div>
                    <div className="text-xs sm:text-sm text-gray-500">Data: {fmtData(d.data_divida)}</div>
                    {d.observacao && (
                      <div className="mt-1 text-xs text-gray-600 line-clamp-2" title={d.observacao}>{d.observacao}</div>
                    )}
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Status: {d.status}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-500">Total</div>
                    <div className="text-lg sm:text-xl font-semibold text-green-600">{fmtMT(d.valor_total)}</div>
                    <div className="mt-1 text-xs text-gray-500">Pago: {fmtMT(d.valor_pago)}</div>
                    <div className="mt-0.5 text-xs text-gray-700 font-medium">Restante: {fmtMT(restante)}</div>
                  </div>
                </div>
                <div className="pt-2 border-t flex items-center justify-end gap-2">
                  <button className="btn-secondary text-xs px-3 py-1" onClick={() => openDetail(d)}>Ver detalhes</button>
                  <button
                    className="btn-primary text-xs px-3 py-1 disabled:opacity-50"
                    disabled={restante <= 0}
                    onClick={() => openPayModal(d)}
                  >
                    Registrar pagamento
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showPayModal && selectedDivida && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Registrar pagamento</h2>
              <button className="text-gray-500 hover:text-gray-700" onClick={closePayModal} disabled={paying}>✕</button>
            </div>
            <div className="text-sm text-gray-600">
              <div>Cliente: <b>{selectedDivida.cliente_nome || '—'}</b></div>
              <div>Total: <b>{fmtMT(selectedDivida.valor_total)}</b></div>
              <div>Pago: <b>{fmtMT(selectedDivida.valor_pago)}</b></div>
              <div>Restante: <b>{fmtMT(Math.max(0, Number(selectedDivida.valor_total ?? 0) - Number(selectedDivida.valor_pago ?? 0)))}</b></div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Valor a pagar</label>
              <input type="number" step="0.01" min="0" className="input w-full" value={payAmount} onChange={e => setPayAmount(e.target.value)} disabled={paying} />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Forma de pagamento</label>
              <select className="input w-full" value={payMethod} onChange={e => setPayMethod(e.target.value)} disabled={paying}>
                <option value="dinheiro">Dinheiro</option>
                <option value="mpesa">M-Pesa</option>
                <option value="emola">e-Mola</option>
                <option value="transferencia">Transferência</option>
                <option value="pos">POS</option>
              </select>
            </div>
            {payError && <div className="text-sm text-red-600">{payError}</div>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button className="btn-secondary px-3 py-1" onClick={closePayModal} disabled={paying}>Cancelar</button>
              <button className="btn-primary px-3 py-1" onClick={submitPayment} disabled={paying}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedDivida && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Detalhes da dívida</h2>
              <button className="text-gray-500 hover:text-gray-700" onClick={closeDetail}>✕</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
              <div><span className="text-gray-500">ID Local:</span> <b>{selectedDivida.id_local ?? '—'}</b></div>
              <div><span className="text-gray-500">UUID:</span> <b className="break-all">{selectedDivida.id || '—'}</b></div>
              <div className="sm:col-span-2"><span className="text-gray-500">Cliente:</span> <b>{selectedDivida.cliente_nome || '—'}</b></div>
              <div><span className="text-gray-500">Data:</span> <b>{fmtData(selectedDivida.data_divida)}</b></div>
              <div><span className="text-gray-500">Status:</span> <b>{selectedDivida.status}</b></div>
              <div><span className="text-gray-500">Total:</span> <b>{fmtMT(selectedDivida.valor_total)}</b></div>
              <div><span className="text-gray-500">Pago:</span> <b>{fmtMT(selectedDivida.valor_pago)}</b></div>
              <div className="sm:col-span-2"><span className="text-gray-500">Observação:</span> <div className="mt-1 whitespace-pre-wrap break-words">{selectedDivida.observacao || '—'}</div></div>
            </div>
            <div className="pt-2 border-t">
              <h3 className="font-semibold mb-2">Itens</h3>
              {selectedDivida._loading && <div className="text-sm text-gray-500">Carregando itens…</div>}
              {selectedDivida._error && <div className="text-sm text-red-600">{selectedDivida._error}</div>}
              {!selectedDivida._loading && Array.isArray(selectedDivida.itens) && selectedDivida.itens.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-1 pr-2">Produto</th>
                        <th className="py-1 pr-2">Qtd</th>
                        <th className="py-1 pr-2">Preço</th>
                        <th className="py-1 pr-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDivida.itens.map((it, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="py-1 pr-2 break-words">{it.produto_nome || it.produto_id || '—'}</td>
                          <td className="py-1 pr-2">{Number(it.quantidade ?? 0)}</td>
                          <td className="py-1 pr-2">{fmtMT(it.preco_unitario)}</td>
                          <td className="py-1 pr-2">{fmtMT(it.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (!selectedDivida._loading && <div className="text-sm text-gray-500">Sem itens.</div>)}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button className="btn-secondary px-3 py-1" onClick={closeDetail}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
