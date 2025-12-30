
import os
import sys
import shutil
import subprocess

# --- Configuration ---
DATASET_YAML = "yolo_dataset/data.yaml"
PROJECT_NAME = "neko_card_detector"
OUTPUT_DIR = "yolo_runs"
TFJS_OUTPUT_DIR = "yolo_tfjs_model"

def install_dependencies():
    print("📦 Installing dependencies...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "ultralytics", "tensorflowjs"])

def train_yolo():
    from ultralytics import YOLO

    print("🚀 Starting YOLO Training...")
    
    # Load a model (nano is best for web/mobile)
    model = YOLO("yolov8n.pt")

    # Train the model
    # imgsz=640 is standard
    # epochs=50 (adjust based on needs)
    results = model.train(
        data=DATASET_YAML,
        epochs=50,
        imgsz=640,
        project=OUTPUT_DIR,
        name=PROJECT_NAME,
        exist_ok=True
    )

    print("✅ Training Complete!")
    
    # Return path to best weights
    best_weights = os.path.join(OUTPUT_DIR, PROJECT_NAME, "weights", "best.pt")
    return best_weights

def export_to_tfjs(weights_path):
    from ultralytics import YOLO
    
    print(f"🔄 Exporting {weights_path} to TFJS...")
    
    model = YOLO(weights_path)
    
    # Export to TFJS
    # format='tfjs' automatically uses tensorflowjs_converter
    model.export(format="tfjs")
    
    # Move result to our target folder
    # Ultralytics exports to a folder named '{weights}_web_model' usually in the same dir as weights
    source_dir = weights_path.replace(".pt", "_web_model")
    
    if os.path.exists(TFJS_OUTPUT_DIR):
        print(f"🧹 Cleaning existing output dir: {TFJS_OUTPUT_DIR}")
        shutil.rmtree(TFJS_OUTPUT_DIR)
    
    # Ensure parent dir exists
    os.makedirs(os.path.dirname(TFJS_OUTPUT_DIR), exist_ok=True)
        
    if os.path.exists(source_dir):
        shutil.move(source_dir, TFJS_OUTPUT_DIR)
        print(f"📂 Model exported to: {TFJS_OUTPUT_DIR}")
        print("✅ Ready to use in React!")
    else:
        print(f"⚠️ Could not find exported model at {source_dir}. Check console logs.")

def main():
    try:
        # 1. Install deps if needed (simple check)
        try:
            import ultralytics
            import tensorflowjs
        except ImportError:
            install_dependencies()

        # 2. Check dataset exists
        if not os.path.exists(DATASET_YAML):
            print(f"❌ Dataset config not found at {DATASET_YAML}")
            print("   Please run 'npx tsx scripts/convert-dataset-yolo.ts' first!")
            return

        # 3. Train
        best_weights = train_yolo()
        
        # 4. Export
        export_to_tfjs(best_weights)

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
