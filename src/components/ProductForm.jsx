import { useEffect, useState } from 'react'
import { api } from '../services/api'

export default function ProductForm({ initial, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState({
    nome: '',
    codigo: '',
    preco_venda: '',
    preco_custo: '',
    estoque: '',
    estoque_minimo: '',
    unidade_medida: 'un',
    venda_por_peso: false,
    categoria_id: '',
    descricao: '',
    taxa_iva: '0',
  })
  const [categorias, setCategorias] = useState([])
  const [categoriasErro, setCategoriasErro] = useState(null)

  useEffect(() => {
    if (initial) {
      setForm({
        nome: initial.nome ?? '',
        codigo: initial.codigo ?? '',
        preco_venda: initial.preco_venda ?? initial.preco ?? '',
        preco_custo: initial.preco_custo ?? '',
        estoque: initial.estoque ?? '',
        estoque_minimo: initial.estoque_minimo ?? '',
        unidade_medida: initial.unidade_medida ?? 'un',
        venda_por_peso: Boolean(initial.venda_por_peso),
        categoria_id: initial.categoria_id ?? '',
        descricao: initial.descricao ?? '',
        taxa_iva: (initial.taxa_iva ?? 0).toString(),
      })
    }
  }, [initial])

  // Carregar categorias
  useEffect(() => {
    let mounted = true
    async function loadCats() {
      try {
        const data = await api.getCategorias()
        const arr = Array.isArray(data) ? data : (data?.items || data?.results || [])
        if (mounted) setCategorias(arr)
      } catch (e) {
        if (mounted) setCategoriasErro(e.message || 'Falha ao carregar categorias')
      }
    }
    loadCats()
    return () => { mounted = false }
  }, [])

  function update(k, v) { setForm(prev => ({ ...prev, [k]: v })) }
  function handleSubmit(e) {
    e.preventDefault()
    // Validações básicas
    if (!form.nome?.trim()) { alert('Nome é obrigatório'); return }
    if (!form.codigo?.trim()) { alert('Código é obrigatório'); return }
    // Categoria obrigatória (sempre)
    if (!String(form.categoria_id || '').trim()) { alert('Categoria é obrigatória'); return }

    const unidade = form.venda_por_peso ? 'kg' : 'un'

    // Detectar se a categoria selecionada é "Serviços" (id/nome)
    const catSelecionada = categorias.find((c) => String(c.id ?? c.uuid ?? '') === String(form.categoria_id ?? ''))
    const nomeCat = (catSelecionada?.nome || '').toLowerCase()
    const isServicos = nomeCat === 'serviços' || nomeCat === 'servicos'

    const payload = {
      ...form,
      preco_venda: Number(form.preco_venda || 0),
      // Para serviços, não controlar custo/estoque: enviar sempre null
      preco_custo: isServicos ? null : (form.preco_custo === '' ? null : Number(form.preco_custo)),
      estoque: isServicos ? null : (form.estoque === '' ? null : Number(form.estoque)),
      estoque_minimo: isServicos ? null : (form.estoque_minimo === '' ? null : Number(form.estoque_minimo)),
      categoria_id: form.categoria_id === '' ? null : form.categoria_id,
      unidade_medida: unidade,
      taxa_iva: Number(form.taxa_iva || 0),
    }
    onSubmit?.(payload)
  }

  // Detectar se a categoria atual é "Serviços" para controlar UI (desabilitar campos)
  const catSelecionada = categorias.find((c) => String(c.id ?? c.uuid ?? '') === String(form.categoria_id ?? ''))
  const nomeCat = (catSelecionada?.nome || '').toLowerCase()
  const isServicos = nomeCat === 'serviços' || nomeCat === 'servicos'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Linha 1: Código, Categoria, Nome */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-1">
          <label className="label">Código</label>
          <input className="input w-full" value={form.codigo} onChange={e => update('codigo', e.target.value)} placeholder="Ex.: 0001" />
        </div>
        <div className="sm:col-span-1">
          <label className="label">Categoria</label>
          {categoriasErro ? (
            <input className="input w-full" value={form.categoria_id} onChange={e => update('categoria_id', e.target.value)} placeholder="Ex.: Mercearia" required />
          ) : (
            <select
              className="input w-full"
              value={form.categoria_id}
              onChange={e => {
                const v = e.target.value
                setForm(prev => {
                  const next = { ...prev, categoria_id: v }
                  const catSel = categorias.find((c) => String(c.id ?? c.uuid ?? '') === String(v))
                  const nome = (catSel?.nome || '').toLowerCase()
                  const isServ = nome === 'serviços' || nome === 'servicos'
                  if (isServ) {
                    // Para serviços, limpar custo/estoque para alinhar com PDV3
                    next.preco_custo = ''
                    next.estoque = ''
                    next.estoque_minimo = ''
                  }
                  return next
                })
              }}
              required
            >
              <option value="">Selecione uma categoria</option>
              {categorias.map((c) => (
                <option key={c.id || c.uuid || c.nome} value={c.id || c.uuid || ''}>{c.nome || c.descricao || c.id}</option>
              ))}
            </select>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="label">Nome</label>
          <input className="input w-full" value={form.nome} onChange={e => update('nome', e.target.value)} placeholder="Ex.: Arroz Branco 1kg" required />
        </div>
      </div>

      {/* Linha 2: Descrição */}
      <div>
        <label className="label">Descrição</label>
        <textarea className="input w-full" rows={3} value={form.descricao} onChange={e => update('descricao', e.target.value)} placeholder="Opcional: detalhes do produto" />
      </div>

      {/* Linha 3: Preço custo, Preço venda, IVA, Estoque, Estoque mínimo */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="label">Preço custo (MT)</label>
          <input
            type="number"
            step="0.01"
            className="input w-full"
            value={form.preco_custo}
            onChange={e => update('preco_custo', e.target.value)}
            placeholder="0.00"
            disabled={isServicos}
          />
        </div>
        <div>
          <label className="label">{form.venda_por_peso ? 'Preço por KG (MT)' : 'Preço por Unidade (MT)'}</label>
          <input
            type="number"
            step="0.01"
            className="input w-full"
            value={form.preco_venda}
            onChange={e => update('preco_venda', e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="label">IVA (%)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            className="input w-full"
            value={form.taxa_iva}
            onChange={e => update('taxa_iva', e.target.value)}
            placeholder="Ex.: 16.5"
          />
        </div>
        <div>
          <label className="label">{form.venda_por_peso ? 'Estoque (KG)' : 'Estoque (Unidades)'}</label>
          <input
            type="number"
            className="input w-full"
            value={form.estoque}
            onChange={e => update('estoque', e.target.value)}
            placeholder={form.venda_por_peso ? 'Ex.: 25.5' : 'Ex.: 10'}
            disabled={isServicos}
          />
        </div>
        <div>
          <label className="label">Estoque mínimo</label>
          <input
            type="number"
            className="input w-full"
            value={form.estoque_minimo}
            onChange={e => update('estoque_minimo', e.target.value)}
            placeholder="Ex.: 5"
            disabled={isServicos}
          />
        </div>
      </div>

      {/* Linha final: Venda por peso */}
      <div>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" className="checkbox" checked={form.venda_por_peso} onChange={e => update('venda_por_peso', e.target.checked)} />
          <span>Venda por peso</span>
        </label>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" className="btn-outline" onClick={onCancel} disabled={submitting}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </form>
  )
}
