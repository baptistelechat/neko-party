import { useGameStore } from "@/modules/game/store";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Plus, X } from "lucide-react";
import { useState } from "react";

interface AddPlayerDialogProps {
  children: React.ReactNode;
}

export function AddPlayerDialog({ children }: AddPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<string[]>([""]);
  const addPlayer = useGameStore((state) => state.addPlayer);

  const handleNameChange = (index: number, value: string) => {
    const newNames = [...names];
    newNames[index] = value;
    setNames(newNames);
  };

  const addNameField = () => {
    setNames([...names, ""]);
  };

  const removeNameField = (index: number) => {
    const newNames = names.filter((_, i) => i !== index);
    setNames(newNames.length ? newNames : [""]);
  };

  const handleSave = async () => {
    const validNames = names.filter((n) => n.trim() !== "");
    for (const name of validNames) {
      await addPlayer(name);
    }
    setOpen(false);
    setNames([""]); // Reset
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ajouter des joueurs</DialogTitle>
          <DialogDescription>
            Ajoutez un ou plusieurs joueurs à la partie.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
          {names.map((name, index) => (
            <div key={index} className="flex items-center gap-2">
              <Label htmlFor={`name-${index}`} className="sr-only">
                Nom
              </Label>
              <Input
                id={`name-${index}`}
                value={name}
                onChange={(e) => handleNameChange(index, e.target.value)}
                className="flex-1"
                placeholder={`Nom du joueur ${index + 1}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (index === names.length - 1) {
                      addNameField();
                    }
                  }
                }}
              />
              {names.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeNameField(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            onClick={addNameField}
            className="w-full mt-2"
          >
            <Plus className="mr-2 h-4 w-4" /> Ajouter un autre
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
