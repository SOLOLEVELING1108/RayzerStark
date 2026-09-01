import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Library from "@/pages/Library";
import GameManage from "@/pages/GameManage";
import Dependencies from "@/pages/Dependencies";
import Orders from "@/pages/Orders";
import Settings from "@/pages/Settings";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("admin_token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Toaster theme="dark" position="bottom-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Library />} />
            <Route path="/games/new" element={<GameManage />} />
            <Route path="/games/:id" element={<GameManage />} />
            <Route path="/dependencies" element={<Dependencies />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
