import { useState, useRef } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSpinner,
  IonText,
  IonImg,
  IonButtons,
  IonMenuButton,
  IonBadge,
} from '@ionic/react';
import { camera, refresh, scan } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import './Home.css';

interface ScanResult {
  plate: string;
  confidence: number;
  timestamp: Date;
}

const Home: React.FC = () => {
  const [photo, setPhoto] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const takePhoto = async () => {
    try {
      setError(null);
      setScanResult(null);
      
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        correctOrientation: true,
      });

      const dataUrl = photo.dataUrl || null;
      setPhoto(dataUrl);
      
      // Analizar automáticamente después de tomar la foto
      if (dataUrl) {
        await analyzePlateWithGemini(dataUrl);
      }
    } catch (err: unknown) {
      console.error('Error al tomar foto:', err);
      // Si falla la cámara nativa, usar el input file como fallback
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const selectFromGallery = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          setPhoto(result);
          setScanResult(null);
          setError(null);
          
          // Analizar automáticamente después de cargar la imagen
          await analyzePlateWithGemini(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzePlateWithGemini = async (imageDataUrl: string) => {
    setIsScanning(true);
    setError(null);

    try {
      // Extraer la parte base64 de la imagen (sin el prefijo data:image/...)
      const base64Image = imageDataUrl.split(',')[1];
      
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=AIzaSyBAfwlZCOqOWNcIuGqqxSkwh6Ex78ceuO0',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Analiza esta imagen y extrae ÚNICAMENTE el número de la patente/matrícula del vehículo. Responde solo con el número de la patente en formato limpio, sin espacios ni caracteres especiales adicionales. Si no puedes detectar una patente, responde "No detectada".',
                  },
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Error al analizar la imagen con Gemini');
      }

      const data = await response.json();
      const plateText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'No detectada';

      setScanResult({
        plate: plateText,
        confidence: 95, // Gemini no proporciona confianza, usamos un valor fijo
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('Error al analizar con Gemini:', err);
      setError('Error al analizar la imagen. Por favor, intenta nuevamente.');
    } finally {
      setIsScanning(false);
    }
  };

  const extractPlateNumber = (text: string): string => {
    // Patrones comunes de patentes latinoamericanas
    const patterns = [
      // Argentina: AB123CD (nuevo formato)
      /^[A-Z]{2}\d{3}[A-Z]{2}$/i,
      // Argentina: ABC123 (formato anterior)
      /^[A-Z]{3}\d{3}$/i,
      // Chile: ABCD12 o AB1234
      /^[A-Z]{2,4}\d{2,4}$/i,
      // Brasil: ABC1234 o ABC1D23
      /^[A-Z]{3}\d{1}[A-Z]{1}\d{2}$/i,
      /^[A-Z]{3}\d{4}$/i,
      // México: ABC123A
      /^[A-Z]{3}\d{3}[A-Z]{1}$/i,
      // Colombia: ABC123
      /^[A-Z]{3}\d{3}$/i,
      // Perú: ABC123
      /^[A-Z]{3}\d{3}$/i,
      // Formato genérico: letras y números combinados
      /^[A-Z]{2,3}\d{2,3}[A-Z]{0,2}$/i,
    ];

    // Limpiar texto y buscar patrones
    const cleanText = text
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 5 && word.length <= 8);

    for (const word of cleanText) {
      for (const pattern of patterns) {
        if (pattern.test(word)) {
          return word.toUpperCase();
        }
      }
    }

    // Si no encuentra patrón exacto, buscar la combinación más probable
    const possiblePlates = text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .match(/[A-Z]{2,3}\d{2,4}[A-Z]{0,2}/g);

    if (possiblePlates && possiblePlates.length > 0) {
      // Retornar la más larga que tenga al menos una letra y un número
      const validPlates = possiblePlates.filter(
        plate => /[A-Z]/.test(plate) && /\d/.test(plate)
      );
      if (validPlates.length > 0) {
        return validPlates.sort((a, b) => b.length - a.length)[0];
      }
    }

    return 'No detectada';
  };

  const scanPlate = async () => {
    if (!photo) return;
    await analyzePlateWithGemini(photo);
  };

  const resetScan = () => {
    setPhoto(null);
    setScanResult(null);
    setError(null);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>
            <IonIcon icon={scan} style={{ marginRight: '8px' }} />
            Patentado
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <div className="container">
          {!photo ? (
            <div className="upload-section">
              <IonCard className="upload-card">
                <IonCardContent className="upload-content">
                  <IonIcon icon={camera} className="camera-icon" />
                  <IonText>
                    <h2>Escanear Patente</h2>
                    <p>Toma una foto clara de la patente del vehículo</p>
                  </IonText>
                  <IonButton expand="block" onClick={takePhoto} size="large">
                    <IonIcon slot="start" icon={camera} />
                    Tomar Foto
                  </IonButton>
                  <IonButton
                    expand="block"
                    fill="outline"
                    onClick={selectFromGallery}
                  >
                    Seleccionar de Galería
                  </IonButton>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </IonCardContent>
              </IonCard>
            </div>
          ) : (
            <div className="result-section">
              <IonCard className="photo-card">
                <IonImg src={photo} className="captured-photo" />
              </IonCard>

              {isScanning && (
                <IonCard className="scanning-card">
                  <IonCardContent className="scanning-content">
                    <IonSpinner name="crescent" />
                    <IonText>
                      <p>Analizando imagen...</p>
                    </IonText>
                  </IonCardContent>
                </IonCard>
              )}

              {scanResult && (
                <IonCard className="result-card">
                  <IonCardHeader>
                    <IonCardTitle className="result-title">
                      Patente Detectada
                    </IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <div className="plate-display">
                      <IonBadge color="success" className="plate-badge">
                        {scanResult.plate}
                      </IonBadge>
                    </div>
                    <div className="result-details">
                      <IonText color="medium">
                        <p>Confianza: {scanResult.confidence}%</p>
                        <p>
                          Fecha:{' '}
                          {scanResult.timestamp.toLocaleDateString('es-CL')}{' '}
                          {scanResult.timestamp.toLocaleTimeString('es-CL')}
                        </p>
                      </IonText>
                    </div>
                  </IonCardContent>
                </IonCard>
              )}

              {error && (
                <IonCard className="error-card">
                  <IonCardContent>
                    <IonText color="danger">
                      <p>{error}</p>
                    </IonText>
                  </IonCardContent>
                </IonCard>
              )}

              <div className="action-buttons">
                {!scanResult && !isScanning && (
                  <IonButton
                    expand="block"
                    onClick={scanPlate}
                    size="large"
                    color="success"
                  >
                    <IonIcon slot="start" icon={scan} />
                    Analizar Patente
                  </IonButton>
                )}
                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={resetScan}
                  disabled={isScanning}
                >
                  <IonIcon slot="start" icon={refresh} />
                  Nueva Captura
                </IonButton>
              </div>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;