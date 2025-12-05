import { useEffect, useState } from 'react'

export default function UserForm({ initial, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState({
    nome: '',
    usuario: '',
    senha: '',
    is_admin: false,
    ativo: true,
    salario: '',
    pode_abastecer: false,
    pode_gerenciar_despesas: false,
    pode_fazer_devolucao: false,
  })

  useEffect(() => {
    if (initial) {
      setForm({
        nome: initial.nome ?? '',
        usuario: initial.usuario ?? '',
        senha: '', // senha não vem do servidor; deixe em branco para não alterar
        is_admin: Boolean(initial.is_admin),
        ativo: initial.ativo !== false,
        salario: initial.salario ?? '',
        pode_abastecer: Boolean(initial.pode_abastecer),
        pode_gerenciar_despesas: Boolean(initial.pode_gerenciar_despesas),
        pode_fazer_devolucao: Boolean(initial.pode_fazer_devolucao),
      })
    }
  }, [initial])

  function update(k, v) { setForm((prev) => ({ ...prev, [k]: v })) }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome?.trim()) { alert('Nome é obrigatório'); return }
    if (!form.usuario?.trim()) { alert('Usuário é obrigatório'); return }
    // Montar payload respeitando schemas do backend:
    // - UsuarioCreate: nome, usuario, senha, is_admin, salario, pode_abastecer, pode_gerenciar_despesas
    // - UsuarioUpdate: todos opcionais + ativo
    const base = {
      nome: form.nome.trim(),
      usuario: form.usuario.trim(),
      is_admin: Boolean(form.is_admin),
      // Enviar apenas se possuir valor numérico
      ...(form.salario !== '' ? { salario: Number(form.salario) } : {}),
      pode_abastecer: Boolean(form.pode_abastecer),
      pode_gerenciar_despesas: Boolean(form.pode_gerenciar_despesas),
      pode_fazer_devolucao: Boolean(form.pode_fazer_devolucao),
    }

    let payload = { ...base }

    if (!initial) {
      // Criação: senha é obrigatória e NÃO enviar 'ativo'
      if (!form.senha?.trim()) { alert('Senha é obrigatória para novo usuário'); return }
      payload.senha = form.senha
    } else {
      // Edição: senha apenas se informada; 'ativo' permitido
      if (form.senha?.trim()) payload.senha = form.senha
      payload.ativo = Boolean(form.ativo)
    }
    onSubmit?.(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Nome</label>
          <input className="input w-full" value={form.nome} onChange={e => update('nome', e.target.value)} required />
        </div>
        <div>
          <label className="label">Usuário</label>
          <input className="input w-full" value={form.usuario} onChange={e => update('usuario', e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Senha {initial ? '(deixe vazio para manter)' : ''}</label>
          <input type="password" className="input w-full" value={form.senha} onChange={e => update('senha', e.target.value)} />
        </div>
        <div>
          <label className="label">Salário (MT)</label>
          <input type="number" step="0.01" className="input w-full" value={form.salario} onChange={e => update('salario', e.target.value)} />
        </div>
        <div className="sm:col-span-2 flex items-center gap-6">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="checkbox" checked={form.is_admin} onChange={e => update('is_admin', e.target.checked)} />
            <span>Administrador</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="checkbox" checked={form.ativo} onChange={e => update('ativo', e.target.checked)} />
            <span>Ativo</span>
          </label>
        </div>
        <div className="sm:col-span-2 flex items-center gap-6">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="checkbox" checked={form.pode_abastecer} onChange={e => update('pode_abastecer', e.target.checked)} />
            <span>Pode abastecer produtos</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="checkbox" checked={form.pode_gerenciar_despesas} onChange={e => update('pode_gerenciar_despesas', e.target.checked)} />
            <span>Pode gerenciar despesas</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="checkbox" checked={form.pode_fazer_devolucao} onChange={e => update('pode_fazer_devolucao', e.target.checked)} />
            <span>Pode fazer devoluções</span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" className="btn-outline" onClick={onCancel} disabled={submitting}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </form>
  )
}
