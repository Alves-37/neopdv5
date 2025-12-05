import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'

export default function Abastecimentos() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(20)
  const [hasNext, setHasNext] = useState(false)

  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [produtoQuery, setProdutoQuery] = useState('')
  const [produtoSugestoes, setProdutoSugestoes] = useState([])
  const [showSugestoes, setShowSugestoes] = useState(false)
  const [usuarioId, setUsuarioId] = useState('')
  const [ordenacao, setOrdenacao] = useState('created_at_desc')

  const params = useMemo(() => ({
    data_inicial: dataInicial || undefined,
    data_final: dataFinal || undefined,
    usuario_id: usuarioId || undefined,
    produto_id: produtoId || undefined,
    pagina,
    limite,
    ordenacao,
  }), [dataInicial, dataFinal, usuarioId, produtoId, pagina, limite, ordenacao])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.getAbastecimentosHistorico(params)
      setItems(res?.items || [])
      setHasNext(!!res?.has_next)
    } catch (e) {
      setError(e?.message || 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [params])

  // Autocomplete de produtos (debounce simples)
  useEffect(() => {
    let active = true
    const q = (produtoQuery || '').trim()
    if (!q) {
      setProdutoSugestoes([])
      return
    }
    const handle = setTimeout(async () => {
      try {
        const result = await api.getProdutos(q)
        if (!active) return
        setProdutoSugestoes(Array.isArray(result) ? result.slice(0, 10) : [])
      } catch {
        if (!active) return
        setProdutoSugestoes([])
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [produtoQuery])

  function handleProdutoSelect(p) {
    setProdutoId(p?.id || '')
    setProdutoQuery(p?.nome ? `${p.nome}${p.codigo ? ` (${p.codigo})` : ''}` : '')
    setShowSugestoes(false)
  }

  function clearProduto() {
    setProdutoId('')
    setProdutoQuery('')
    setProdutoSugestoes([])
  }

  function exportCSV() {
    const headers = [
      'Data', 'Produto', 'Código', 'Quantidade', 'Custo Unitário', 'Total Custo', 'Usuário', 'Observação'
    ]
    const rows = items.map(r => [
      r.created_at ? new Date(r.created_at).toLocaleString() : '',
      r.produto_nome || '',
      r.codigo || '',
      String(r.quantidade ?? ''),
      String(r.custo_unitario ?? ''),
      String(r.total_custo ?? ''),
      r.usuario_nome || '',
      (r.observacao || '').replaceAll('\n', ' ').replaceAll('"', '""'),
    ])
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => {
      const needsQuote = /[",\n]/.test(cell)
      const val = String(cell).replaceAll('"', '""')
      return needsQuote ? `"${val}"` : val
    }).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abastecimentos_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function exportPDF() {
    // Gera uma visualização imprimível; o usuário pode "Salvar como PDF"
    const w = window.open('', '_blank')
    if (!w) return
    const style = `
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 16px; }
        h1 { font-size: 18px; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; }
        td.num { text-align: right; }
      </style>
    `
    const header = `<h1>Histórico de Abastecimentos</h1>`
    const tableHead = `
      <thead>
        <tr>
          <th>Data</th>
          <th>Produto</th>
          <th>Código</th>
          <th>Quantidade</th>
          <th>Custo Unit.</th>
          <th>Total Custo</th>
          <th>Usuário</th>
          <th>Obs.</th>
        </tr>
      </thead>
    `
    const tableBody = `
      <tbody>
        ${items.map(r => `
          <tr>
            <td>${r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
            <td>${r.produto_nome || ''}</td>
            <td>${r.codigo || ''}</td>
            <td class="num">${Number(r.quantidade || 0).toLocaleString()}</td>
            <td class="num">${Number(r.custo_unitario || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="num">${Number(r.total_custo || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>${r.usuario_nome || ''}</td>
            <td>${(r.observacao || '').replaceAll('<','&lt;').replaceAll('>','&gt;')}</td>
          </tr>
        `).join('')}
      </tbody>
    `
    const html = `<!doctype html><html><head><meta charset="utf-8">${style}</head><body>${header}<table>${tableHead}${tableBody}</table></body></html>`
    w.document.open()
    w.document.write(html)
    w.document.close()
    w.focus()
    // Aguarda um tick antes de imprimir
    setTimeout(() => { w.print(); w.close(); }, 300)
  }

  function handleSubmit(e) {
    e.preventDefault()
    setPagina(1)
    load()
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Histórico de Abastecimentos</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4 relative">
        <div>
          <label className="block text-sm mb-1">Data inicial</label>
          <input type="date" value={dataInicial} onChange={e => setDataInicial(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm mb-1">Data final</label>
          <input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Produto</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Pesquisar por nome ou código"
              value={produtoQuery}
              onChange={e => { setProdutoQuery(e.target.value); setShowSugestoes(true) }}
              onFocus={() => setShowSugestoes(true)}
              className="w-full border rounded px-2 py-1"
            />
            {produtoQuery && (
              <button type="button" onClick={clearProduto} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">×</button>
            )}
            {showSugestoes && produtoSugestoes.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow max-h-60 overflow-auto">
                {produtoSugestoes.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-gray-100"
                    onClick={() => handleProdutoSelect(p)}
                  >
                    <div className="text-sm font-medium">{p.nome}</div>
                    <div className="text-xs text-gray-600">{p.codigo}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Campo oculto com o UUID selecionado (se houver) */}
          {produtoId ? (
            <div className="text-xs text-gray-600 mt-1">Selecionado: <span className="font-medium">{produtoId}</span></div>
          ) : null}
        </div>
        <div>
          <label className="block text-sm mb-1">Usuário ID</label>
          <input type="text" placeholder="UUID do usuário" value={usuarioId} onChange={e => setUsuarioId(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm mb-1">Ordenação</label>
          <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)} className="w-full border rounded px-2 py-1">
            <option value="created_at_desc">Mais recentes</option>
            <option value="created_at_asc">Mais antigos</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" disabled={loading} className="px-3 py-2 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">Filtrar</button>
          <button type="button" onClick={() => { setDataInicial(''); setDataFinal(''); setProdutoId(''); setUsuarioId(''); setPagina(1); }} className="px-3 py-2 rounded border">Limpar</button>
        </div>
      </form>

      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">{loading ? 'Carregando...' : `${items.length} registros`}</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportCSV} className="px-3 py-1.5 rounded border">Exportar CSV</button>
          <button type="button" onClick={exportPDF} className="px-3 py-1.5 rounded border">Exportar PDF</button>
          <label className="text-sm">Linhas:</label>
          <select value={limite} onChange={e => { setLimite(Number(e.target.value)); setPagina(1) }} className="border rounded px-2 py-1 text-sm">
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded mb-3">{error}</div>
      ) : null}

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2 border-b">Data</th>
              <th className="text-left p-2 border-b">Produto</th>
              <th className="text-left p-2 border-b">Código</th>
              <th className="text-right p-2 border-b">Quantidade</th>
              <th className="text-right p-2 border-b">Custo Unit.</th>
              <th className="text-right p-2 border-b">Total Custo</th>
              <th className="text-left p-2 border-b">Usuário</th>
              <th className="text-left p-2 border-b">Obs.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 border-b whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                <td className="p-2 border-b">{r.produto_nome || '-'}</td>
                <td className="p-2 border-b">{r.codigo || '-'}</td>
                <td className="p-2 border-b text-right">{Number(r.quantidade || 0).toLocaleString()}</td>
                <td className="p-2 border-b text-right">{Number(r.custo_unitario || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-2 border-b text-right font-medium">{Number(r.total_custo || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-2 border-b">{r.usuario_nome || '-'}</td>
                <td className="p-2 border-b max-w-[280px] truncate" title={r.observacao || ''}>{r.observacao || ''}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td className="p-3 text-center text-gray-500" colSpan={8}>Nenhum registro encontrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3">
        <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1 || loading} className="px-3 py-2 rounded border disabled:opacity-50">Anterior</button>
        <span className="text-sm">Página {pagina}</span>
        <button onClick={() => setPagina(p => (hasNext ? p + 1 : p))} disabled={!hasNext || loading} className="px-3 py-2 rounded border disabled:opacity-50">Próxima</button>
      </div>
    </div>
  )
}
