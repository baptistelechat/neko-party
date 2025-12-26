import { Button } from "@/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function History() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold">Historique</h1>
      </div>
      
      <div className="text-center text-muted-foreground mt-12">
        Aucune partie enregistrée pour le moment.
      </div>
    </div>
  );
}
