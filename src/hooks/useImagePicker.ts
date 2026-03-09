import { useState } from "react";
import * as ImagePicker from "expo-image-picker";

type PickedImage = {
    uri: string;
    width: number;
    height: number;
};

export function useImagePicker() {
    const [loading, setLoading] = useState(false);

    // Chọn nhiều ảnh từ thư viện
    const pickFromGallery = async (allowMultiple = true): Promise<PickedImage[]> => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            throw new Error("Cần cấp quyền truy cập thư viện ảnh");
        }

        setLoading(true);
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsMultipleSelection: allowMultiple,
                allowsEditing: !allowMultiple,
                quality: 0.8,
                selectionLimit: 10,
            });

            if (result.canceled || !result.assets.length) return [];

            return result.assets.map((a) => ({
                uri: a.uri,
                width: a.width,
                height: a.height,
            }));
        } finally {
            setLoading(false);
        }
    };

    // Chụp từ camera (luôn 1 ảnh)
    const takePhoto = async (): Promise<PickedImage[]> => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            throw new Error("Cần cấp quyền sử dụng camera");
        }

        setLoading(true);
        try {
            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                quality: 0.8,
                aspect: [4, 3],
            });

            if (result.canceled || !result.assets[0]) return [];

            return [{
                uri: result.assets[0].uri,
                width: result.assets[0].width,
                height: result.assets[0].height,
            }];
        } finally {
            setLoading(false);
        }
    };

    return { pickFromGallery, takePhoto, loading };
}
