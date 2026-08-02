import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import GenerateModal from './components/GenerateModal'
import Dashboard from './pages/Dashboard'
import Sites from './pages/Sites'
import ManageSites from './pages/ManageSites'
import InspectionDetail from './pages/InspectionDetail'
import Help from './pages/Help'

export default function App() {
  return (
    <BrowserRouter>
      <GenerateModal />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="sites" element={<Sites />} />
          <Route path="manage-sites" element={<ManageSites />} />
          <Route path="inspections/:auditId" element={<InspectionDetail />} />
          <Route path="help" element={<Help />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
