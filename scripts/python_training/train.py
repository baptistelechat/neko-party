import os
import sys
import shutil
import subprocess

# --- Configuration ---
# Assuming script is run from python_training directory or we resolve relative to it
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))

DATASET_YAML = os.path.join(PROJECT_ROOT, "public", "dataset", "yolo_dataset", "data.yaml")
PROJECT_NAME = "neko_card_detector"
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "runs")
TFJS_OUTPUT_DIR = os.path.join(PROJECT_ROOT, "public", "models", "yolo_tfjs")
ONNX_OUTPUT_PATH = os.path.join(PROJECT_ROOT, "public", "models", "detection", "neko-skyjo-yolo_model.onnx")

def update_dataset_yaml():
    """Updates data.yaml with the correct absolute path for the current machine."""
    if not os.path.exists(DATASET_YAML):
        print(f"❌ Error: {DATASET_YAML} not found!")
        sys.exit(1)

    dataset_root = os.path.join(PROJECT_ROOT, "public", "dataset", "yolo_dataset")
    # Convert to forward slashes for YAML compatibility (even on Windows)
    dataset_root = dataset_root.replace("\\", "/")
    
    with open(DATASET_YAML, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    path_updated = False
    
    for line in lines:
        if line.strip().startswith('path:'):
            new_lines.append(f"path: {dataset_root} # dataset root dir\n")
            path_updated = True
        elif line.strip().startswith('val:'):
             # Ensure val path points to validation folder
             new_lines.append("val: images/validation\n")
        else:
            new_lines.append(line)
            
    if not path_updated:
        # If path line wasn't found, insert it at the top
        new_lines.insert(0, f"path: {dataset_root} # dataset root dir\n")
    
    with open(DATASET_YAML, 'w') as f:
        f.writelines(new_lines)
    
    print(f"✅ Updated data.yaml with absolute path: {dataset_root}")

def train_yolo():
    from ultralytics import YOLO

    # Ensure dataset path is correct for this machine
    update_dataset_yaml()

    print("🚀 Starting YOLO Training...")
    
    # Load a model (nano is best for web/mobile)
    model = YOLO("yolov8n.pt")

    # Train the model
    # imgsz=640 is standard
    # epochs=100 (increased to allow Early Stopping to trigger)
    # patience=15 (stop if no improvement for 15 epochs)
    results = model.train(
        data=DATASET_YAML,
        epochs=100,
        patience=15,
        imgsz=640,
        project=OUTPUT_DIR,
        name=PROJECT_NAME,
        exist_ok=True
    )

    print("✅ Training Complete!")
    
    # Return path to best weights
    best_weights = os.path.join(OUTPUT_DIR, PROJECT_NAME, "weights", "best.pt")
    return best_weights

def export_to_onnx(weights_path):
    from ultralytics import YOLO
    
    print(f"🔄 Exporting {weights_path} to ONNX...")
    
    model = YOLO(weights_path)
    
    # Export to ONNX
    export_path = model.export(format="onnx")
    
    # Handle return value (it might be a string or list)
    if isinstance(export_path, list):
        export_path = export_path[0]
        
    # Sometimes export returns None or just prints path, so we verify file existence
    expected_onnx = weights_path.replace(".pt", ".onnx")
    
    if os.path.exists(expected_onnx):
        print(f"📂 Exported to: {expected_onnx}")
        
        # Ensure parent dir exists
        os.makedirs(os.path.dirname(ONNX_OUTPUT_PATH), exist_ok=True)
        
        print(f"📋 Copying to {ONNX_OUTPUT_PATH}...")
        shutil.copy2(expected_onnx, ONNX_OUTPUT_PATH)
        print("✅ ONNX model updated in public folder! Ready for ObjectDetector.ts")
    else:
        print(f"⚠️ Could not find exported ONNX model at {expected_onnx}. Check console logs.")

def main():
    try:
        # 1. Check dataset exists
        if not os.path.exists(DATASET_YAML):
            print(f"❌ Dataset config not found at {DATASET_YAML}")
            print("   Please run 'npx tsx scripts/convert-dataset-yolo.ts' first!")
            return

        # 2. Train
        best_weights = train_yolo()
        
        # 3. Export
        export_to_onnx(best_weights)

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
