import { Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './routes/PrivateRoute'
import AppLayout from './layouts/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Produtos from './pages/Produtos'
import Usuarios from './pages/Usuarios'
import Clientes from './pages/Clientes'
import Vendas from './pages/Vendas'
import RelatoriosFinanceiros from './pages/RelatoriosFinanceiros'
import Configuracoes from './pages/Configuracoes'
import Dividas from './pages/Dividas'
import Abastecimentos from './pages/Abastecimentos'

function App() {
  return (
    <Routes>
      {/* Rota pública de login */}
      <Route path="/login" element={<Login />} />

      {/* Rotas privadas com layout */}
      <Route element={<PrivateRoute />}> 
        <Route element={<AppLayout />}> 
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/abastecimentos" element={<Abastecimentos />} />
          <Route path="/dividas" element={<Dividas />} />
          <Route path="/relatorios-financeiros" element={<RelatoriosFinanceiros />} />
          <Route path="/configuracoes" element={<Configuracoes />} />

          {/* Redirect raiz para dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      {/* Catch-all: redireciona para dashboard se autenticado, senão login */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
