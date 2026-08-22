import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuditProvider } from "@/context/AuditContext";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import AuditView from "@/pages/AuditView";
import Verification from "@/pages/Verification";
import TamperDemo from "@/pages/TamperDemo";
import Report from "@/pages/Report";

function App() {
    return (
        <div className="App">
            <AuditProvider>
                <BrowserRouter>
                    <Routes>
                        <Route element={<Layout />}>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/audit" element={<AuditView />} />
                            <Route path="/verification" element={<Verification />} />
                            <Route path="/tamper" element={<TamperDemo />} />
                            <Route path="/report" element={<Report />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
                <Toaster theme="dark" position="top-right" richColors />
            </AuditProvider>
        </div>
    );
}

export default App;
