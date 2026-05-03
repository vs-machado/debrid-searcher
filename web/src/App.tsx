import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/login/LoginPage'
import RequireAuth from './pages/login/components/RequireAuth'
import SearchPage from './pages/search/SearchPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<SearchPage />} />
        <Route path="/history" element={<SearchPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
