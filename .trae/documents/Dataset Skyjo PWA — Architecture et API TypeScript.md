# Architecture "One Scan = One Zip"

Conformément à votre demande, nous allons simplifier le flux pour le "Mode Collecte" :
1.  Vous cadrez une carte.
2.  Vous validez/capturez.
3.  Un ZIP est généré et téléchargé immédiatement pour cette carte unique.

## 1. Implémentation (`src/modules/dataset/DatasetService.ts`)

Ce service sera stateless (pas de mémoire de session).

### Fonction `exportCardDataset(video, label, bbox)`
Cette fonction unique effectue toutes les opérations :
1.  **Extraction Raw** : `video` -> `canvas` -> `blob (jpg)`.
2.  **Extraction Crop** : Découpe la zone `bbox` -> `blob (jpg)`.
3.  **Génération Annotation** : Crée le JSON avec les coordonnées et le label.
4.  **Génération Features** : Récupère les features du `CardClassifierService` (si disponibles).
5.  **Création ZIP** : Archive le tout avec `JSZip`.
6.  **Téléchargement** : Déclenche le téléchargement du fichier `neko_dataset_[label]_[timestamp].zip`.

## 2. Types (`src/modules/dataset/types.ts`)

```typescript
export interface DatasetEntry {
  raw: Blob;
  crop: Blob;
  annotation: string; // JSON string
  features?: string; // JSON string
  filename: string; // Base filename (ex: "skyjo_1735...")
}
```

## 3. Intégration dans `Scan.tsx`

Nous allons modifier le comportement du bouton "Sauver" (ou en ajouter un dédié "Sauver Dataset") en mode Train.

*   **Action "Apprendre"** : Continue d'ajouter l'exemple au modèle en mémoire (pour le feedback visuel immédiat "ça marche").
*   **Action "Sauver"** : Appelle `DatasetService.exportCardDataset` avec la dernière image capturée.

*Note : Pour faciliter la "masse", je m'assurerai que le processus est rapide et ne bloque pas l'interface.*

## Plan d'Action

1.  **Installer JSZip** : `pnpm add jszip` + `@types/jszip`.
2.  **Créer `DatasetService.ts`** : Logique de capture et zippage.
3.  **Modifier `Scan.tsx`** : Brancher le bouton de sauvegarde sur ce nouveau service.
