import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Scan from "@/pages/Scan";
import GamePage from "@/pages/Game";
import History from "@/pages/History";
import TrainingPage from "@/pages/Training";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/history" element={<History />} />
        <Route path="/training" element={<TrainingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
