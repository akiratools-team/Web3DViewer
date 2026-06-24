import { IFCLoader } from 'three/examples/jsm/loaders/IFCLoader.js';
import * as THREE from 'three';

export const loadIFC = async (file: File): Promise<THREE.Group> => {
    console.log("🟢 [LOCAL XỊN] Đã xác nhận Server ngon, đang kéo WASM từ /ifc-wasm/ ...");

    const loader = new IFCLoader();
    
    // Trỏ đường dẫn tuyệt đối thẳng vào thư mục public đã test tải file thành công
    loader.setWasmPath('/ifc-wasm/');

    const arrayBuffer = await file.arrayBuffer();

    return new Promise((resolve, reject) => {
        loader.parse(
            arrayBuffer,
            '',
            (model) => {
                console.log("✅ [THÀNH CÔNG] Đã Parse xong mô hình IFC!");
                resolve(model as THREE.Group);
            },
            (error) => {
                console.error("❌ Lỗi Parse:", error);
                reject(error);
            }
        );
    });
};