import { Routes, Route } from 'react-router-dom'
import ResidentView from './views/ResidentView'
import AdminView from './views/AdminView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ResidentView />} />
      <Route path="/admin" element={<AdminView />} />
    </Routes>
  )
}
