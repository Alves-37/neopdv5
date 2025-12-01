import { useCallback, useEffect, useState } from 'react'
import api from '../services/api'

export default function Dashboard() {
  const [metricas, setMetricas] = useState({
    vendas_dia: null,
    vendas_mes: null,
    lucro_dia: null,
    lucro_mes: null,
    valor_estoque: null,
    valor_potencial: null,
    lucro_potencial: null,
    baixo_estoque: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [estabNome, setEstabNome] = useState('')

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const nome = params.get('launcher_estab_nome') || ''
      if (nome) setEstabNome(nome)
    } catch {
      // ignore
    }
  }, [])

  const fmtMT = (v) => {
    if (v === null || v === undefined) return '—'
    try {
      const num = new Intl.NumberFormat('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v))
      return `MT ${num}`
    } catch {
      return `${v}`
    }
  }

  const toYMD = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const loadMetrics = useCallback(async () => {
    let mounted = true
      setLoading(true)
      setError(null)
      try {
        const base = import.meta.env.VITE_API_BASE_URL
        const hoje = new Date()
        const ymdHoje = toYMD(hoje)
        const anoMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
        // 1) Buscar vendas_dia e vendas_mes do servidor com parâmetros explícitos
        const [dia, mes] = await Promise.all([
          fetch(`${base}/api/metricas/vendas-dia?data=${ymdHoje}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${base}/api/metricas/vendas-mes?ano_mes=${anoMes}`).then(r => r.ok ? r.json() : null).catch(() => null),
        ])

        // 2) Tentar obter métricas de estoque direto do backend (alinhado com PDV3)
        let valorEstoque = null
        let valorPotencial = null
        try {
          const mEstoque = await api.getMetricasEstoque()
          if (mEstoque && typeof mEstoque.valor_estoque === 'number' && typeof mEstoque.valor_potencial === 'number') {
            valorEstoque = Number(mEstoque.valor_estoque)
            valorPotencial = Number(mEstoque.valor_potencial)
          }
        } catch { /* ignora e cai no fallback local */ }

        // 2b) Fallback local: calcular estoque e potencial a partir dos produtos (com deduplicação e filtros)
        let baixoEstoqueCount = null
        try {
          const produtosData = await api.getProdutos('')
          const arr = Array.isArray(produtosData) ? produtosData : (produtosData?.items || [])
          // Deduplicar por id/uuid/codigo
          const dedupMap = new Map()
          for (const p of arr) {
            const key = p.id || p.uuid || p.codigo
            if (!key) continue
            if (!dedupMap.has(key)) dedupMap.set(key, p)
          }
          const produtos = Array.from(dedupMap.values())

          let totalEstoque = 0
          let totalPotencial = 0
          let lowCount = 0
          for (const p of produtos) {
            // Filtrar somente ativos (se campo não existir, assume ativo)
            if (p.ativo === false) continue
            const estoque = Number(p.estoque ?? p.quantidade_estoque ?? 0)
            const precoVenda = Number(p.preco_venda ?? p.preco ?? 0)
            const precoCusto = Number(p.preco_custo ?? p.custo ?? 0)
            if (Number.isFinite(estoque) && Number.isFinite(precoCusto)) {
              totalEstoque += estoque * precoCusto
            }
            if (Number.isFinite(estoque) && Number.isFinite(precoVenda)) {
              totalPotencial += estoque * precoVenda
            }
            const min = Number(p.estoque_minimo ?? 0)
            const isLow = min > 0 ? (estoque <= min) : (estoque <= 5)
            if (isLow) lowCount += 1
          }
          if (valorEstoque == null) valorEstoque = totalEstoque
          if (valorPotencial == null) valorPotencial = totalPotencial
          baixoEstoqueCount = lowCount
        } catch { /* mantém null se falhar */ }

        // 3) Calcular localmente lucro do dia e do mês via /api/vendas/periodo
        let lucroDia = null
        let lucroMes = null
        try {
          const hoje = new Date()
          const ymdHoje = toYMD(hoje)
          const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
          const ymdInicioMes = toYMD(inicioMes)

          // Buscar produtos para mapear custo por produto
          const produtosData2 = await api.getProdutos('')
          const produtos2 = Array.isArray(produtosData2) ? produtosData2 : (produtosData2?.items || [])
          const custoPorProduto = {}
          for (const p of produtos2) {
            const key = p.id || p.uuid
            if (!key) continue
            custoPorProduto[key] = Number(p.preco_custo ?? p.custo ?? 0)
          }

          // Função para calcular lucro de uma lista de vendas
          const calcLucro = (vendas) => {
            let lucro = 0
            for (const v of vendas) {
              const itens = v.itens || []
              for (const it of itens) {
                const pid = it.produto_id || it.produto?.id
                const precoUnit = Number(it.preco_unitario ?? 0)
                const qtd = Number(it.peso_kg && it.peso_kg > 0 ? it.peso_kg : (it.quantidade ?? 0))
                const custo = Number(custoPorProduto[pid] ?? 0)
                lucro += (precoUnit - custo) * qtd
              }
            }
            return lucro
          }

          // Lucro do dia
          try {
            const vendasDia = await api.getVendasPeriodo(ymdHoje, ymdHoje)
            const arrDia = Array.isArray(vendasDia) ? vendasDia : (vendasDia?.items || [])
            lucroDia = calcLucro(arrDia)
          } catch { /* leave null */ }

          // Lucro do mês (1º dia até hoje)
          try {
            const vendasMes = await api.getVendasPeriodo(ymdInicioMes, ymdHoje)
            const arrMes = Array.isArray(vendasMes) ? vendasMes : (vendasMes?.items || [])
            lucroMes = calcLucro(arrMes)
          } catch { /* leave null */ }
        } catch { /* mantém null */ }

        if (mounted) setMetricas(m => ({
          ...m,
          vendas_dia: dia?.total ?? m.vendas_dia,
          vendas_mes: mes?.total ?? m.vendas_mes,
          valor_estoque: valorEstoque,
          valor_potencial: valorPotencial,
          lucro_potencial: (valorPotencial != null && valorEstoque != null) ? (valorPotencial - valorEstoque) : null,
          baixo_estoque: baixoEstoqueCount,
          lucro_dia: lucroDia,
          lucro_mes: lucroMes,
        }))
      } catch (e) {
        if (mounted) setError(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let cleanup = loadMetrics()
    // Polling leve (20s) + refresh ao focar/visibilidade
    const intervalId = setInterval(() => { loadMetrics() }, 20000)
    const onFocus = () => loadMetrics()
    const onVisibility = () => { if (document.visibilityState === 'visible') loadMetrics() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (typeof cleanup === 'function') cleanup()
      clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [loadMetrics])

  const StatCard = ({ title, value, color = 'primary', icon }) => {
    // Padrão PDV3: cards sólidos com gradiente e texto branco
    const colorGrad = {
      primary: 'from-primary-600 via-primary-700 to-primary-900',
      secondary: 'from-secondary-600 via-secondary-700 to-secondary-900',
      accent: 'from-accent-600 via-accent-700 to-accent-900',
      danger: 'from-danger-600 via-danger-700 to-danger-900',
    }
    const grad = colorGrad[color] || colorGrad.primary
    return (
      <div className={`rounded-xl p-6 shadow-card hover:shadow-card-hover transition-shadow border border-white/10 bg-gradient-to-br ${grad} text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm/5 text-white/80">{title}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </div>
          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-white/10">
            {icon}
          </div>
        </div>
      </div>
    )
  }

  const LoadingSkeleton = () => (
    <section className="grid grid-cols-2 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
          <div className="h-7 w-36 bg-gray-200 rounded" />
        </div>
      ))}
    </section>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          {estabNome && (
            <span className="text-xs text-gray-500 mt-0.5">{estabNome}</span>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <a href="#" className="btn-outline">Exportar</a>
          <a href="#" className="btn-primary">Nova venda</a>
        </div>
      </div>

      {loading && <p className="text-gray-500">Carregando...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {/* Cards responsivos (2 por linha em todas as telas) */}
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <section className="grid grid-cols-2 gap-4">
          <StatCard
            title="Vendas do dia"
            value={fmtMT(metricas?.vendas_dia)}
            color="primary"
            icon={(<svg className="h-5 w-5 text-primary-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17l-5-5-4 4-3-3"/></svg>)}
          />
          <StatCard
            title="Vendas do mês"
            value={fmtMT(metricas?.vendas_mes)}
            color="secondary"
            icon={(<svg className="h-5 w-5 text-secondary-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>)}
          />
          <StatCard
            title="Lucro do dia"
            value={metricas?.lucro_dia == null ? '—' : fmtMT(metricas.lucro_dia)}
            color="accent"
            icon={(<svg className="h-5 w-5 text-accent-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8l-4 4-2-2"/></svg>)}
          />
          <StatCard
            title="Lucro do mês"
            value={metricas?.lucro_mes == null ? '—' : fmtMT(metricas.lucro_mes)}
            color="danger"
            icon={(<svg className="h-5 w-5 text-danger-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-6"/></svg>)}
          />
          <StatCard
            title="Valor do estoque"
            value={metricas?.valor_estoque == null ? '—' : fmtMT(metricas.valor_estoque)}
            color="primary"
            icon={(<svg className="h-5 w-5 text-primary-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M21 10l-9 4-9-4"/><path d="M21 14l-9 4-9-4"/></svg>)}
          />
          <StatCard
            title="Valor potencial"
            value={metricas?.valor_potencial == null ? '—' : fmtMT(metricas.valor_potencial)}
            color="secondary"
            icon={(<svg className="h-5 w-5 text-secondary-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>)}
          />
          <StatCard
            title="Lucro potencial"
            value={metricas?.lucro_potencial == null ? '—' : fmtMT(metricas.lucro_potencial)}
            color="accent"
            icon={(<svg className="h-5 w-5 text-accent-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l3 3 7-7"/></svg>)}
          />
          <StatCard
            title="Produtos com baixo estoque"
            value={metricas?.baixo_estoque == null ? '—' : metricas.baixo_estoque}
            color="danger"
            icon={(<svg className="h-5 w-5 text-danger-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"/><path d="M3 3h18l-2 13H5L3 3z"/><circle cx="12" cy="18" r="1"/></svg>)}
          />
        </section>
      )}

      {/* Removidas ações rápidas conforme solicitado */}

    </div>
  )
}
