# Requiere: pip install fastapi uvicorn transformers torch pysentimiento pillow python-multipart
from sqlmodel import SQLModel, Field, create_engine, Session, select
from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from transformers import pipeline
from pysentimiento import create_analyzer
from PIL import Image
from datetime import datetime
import numpy as np
import io
import os
from fastapi import Request
from fastapi import Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

class Publicacion(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    texto: str
    fecha: str
    ruta_imagen: str | None = None

class Rechazo(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    texto: str
    fecha: str
    motivo: str

class Etiqueta(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    nombre: str

# Configuración de la base de datos (en memoria para simplicidad)
sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

engine = create_engine(sqlite_url, echo=False)

def crear_db():
    SQLModel.metadata.create_all(engine)

crear_db()  # Ejecuta al iniciar

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Crear carpeta para guardar imágenes
os.makedirs("imagenes_aprobadas", exist_ok=True)


# Inicializar analizadores de texto
analizadores = {
    "sentiment": create_analyzer("sentiment", lang="es"),
    "emotion": create_analyzer("emotion", lang="es"),
    "hate_speech": create_analyzer("hate_speech", lang="es"),
    "irony": create_analyzer("irony", lang="es"),
    "ner": create_analyzer("ner", lang="es"),
    "pos": create_analyzer("pos", lang="es"),
    "targeted_sentiment": create_analyzer("targeted_sentiment", lang="es"),
    "context_hate": create_analyzer("context_hate_speech", lang="es")
}

# Inicializar pipeline CLIP
classifier = pipeline("zero-shot-image-classification", model="openai/clip-vit-base-patch32")

def obtener_labels():
    with Session(engine) as session:
        etiquetas = session.exec(select(Etiqueta)).all()
        return [etq.nombre for etq in etiquetas]
    
# --- Análisis de texto ---
def analizar_texto(texto):
    resultados = {
        "texto": texto,
        "fecha": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    sentiment = analizadores["sentiment"].predict(texto)
    hate = analizadores["hate_speech"].predict(texto)
    context_hate = analizadores["context_hate"].predict(texto)

    resultados["sentiment"] = sentiment.output
    resultados["emotion"] = analizadores["emotion"].predict(texto).output
    resultados["hate_speech"] = hate.output if isinstance(hate.output, list) else []
    resultados["irony"] = analizadores["irony"].predict(texto).output
    resultados["ner"] = [
        {"word": ent["word"], "entity": ent["entity"]}
        for ent in analizadores["ner"].predict(texto).entities
    ]
    resultados["context_hate"] = context_hate.output if isinstance(context_hate.output, list) else []

    resultados["apto"] = (not resultados["hate_speech"] and not resultados["context_hate"])
    return resultados

# --- Análisis de imagen ---
    
def analizar_imagen(file_bytes, threshold):
    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    labels = obtener_labels()
    results = classifier(image, candidate_labels=labels)
    detectadas = [r for r in results if r["score"] >= threshold]
    apta = len(detectadas) == 0
    return {
        "fecha": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "detectadas": detectadas,
        "scores": results,
        "apta": apta
    }

# --- Publicar contenido solo si pasa la moderación ---
@app.post("/publicar")
async def publicar(
    texto: str = Form(...),
    umbral: float = Form(0.3),
    imagen: UploadFile = File(None)
):
    try:
        texto_res = analizar_texto(texto)
        ruta_guardada = None
        motivo = ""  # ← Inicializamos 'motivo' con un valor por defecto

        if imagen:
            imagen_bytes = await imagen.read()
            img_res = analizar_imagen(imagen_bytes, umbral)
        else:
            img_res = {
                "detectadas": [],
                "scores": [],
                "apta": True,
                "fecha": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

        puede_publicar = texto_res["apto"] and img_res["apta"]

        # Si NO se puede publicar, asignamos un motivo
        if not puede_publicar:
            if not texto_res["apto"]:
                motivo += "📝 Texto inapropiado. "
            if not img_res["apta"]:
                motivo += "🖼 Imagen inapropiada."

        if puede_publicar:
            if imagen:
                nombre_archivo = f"imagenes_aprobadas/{datetime.now().strftime('%Y%m%d%H%M%S')}_{imagen.filename}"
                with open(nombre_archivo, "wb") as f:
                    f.write(imagen_bytes)
                ruta_guardada = nombre_archivo

            nueva = Publicacion(
                texto=texto,
                fecha=datetime.now().isoformat(),
                ruta_imagen=ruta_guardada
            )

            with Session(engine) as session:
                session.add(nueva)
                session.commit()

        with Session(engine) as session:
            total = session.exec(select(Publicacion)).all()
            total_publicaciones = len(total)

        return JSONResponse(content={
            "publicado": puede_publicar,
            "texto": texto_res,
            "imagen": img_res,
            "ruta_imagen": ruta_guardada,
            "total_publicaciones": total_publicaciones,
            "motivo": motivo  # ← Ahora 'motivo' siempre estará definido
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})



# --- Obtener publicaciones aceptadas ---

@app.get("/publicaciones")
def get_publicaciones(request: Request):
    with Session(engine) as session:
        resultados = session.exec(select(Publicacion)).all()
        publicaciones_con_url = []
        for pub in resultados:
            pub_dict = pub.dict()
            if pub.ruta_imagen:
                pub_dict["url_imagen"] = str(request.url_for("imagenes", path=pub.ruta_imagen.replace("imagenes_aprobadas/", "")))
            publicaciones_con_url.append(pub_dict)
        return publicaciones_con_url

@app.get("/estadisticas")
def estadisticas():
    with Session(engine) as session:
        total = session.exec(select(Publicacion)).all()
        rechazadas = session.exec(select(Rechazo)).all()

        total_pub = len(total)
        total_rech = len(rechazadas)
        porcentaje = round((total_rech / (total_pub + total_rech)) * 100, 2) if (total_pub + total_rech) else 0

        return {
            "publicaciones": total_pub,
            "rechazadas": total_rech,
            "porcentaje_rechazo": porcentaje
        }

@app.get("/admin_etiquetas", response_class=HTMLResponse)
def admin_etiquetas(request: Request):
    with Session(engine) as session:
        etiquetas = session.exec(select(Etiqueta)).all()
    return templates.TemplateResponse("admin_etiquetas.html", {"request": request, "etiquetas": etiquetas})

@app.post("/admin_etiquetas/agregar")
async def agregar_etiqueta(nombre: str = Form(...)):
    with Session(engine) as session:
        nueva = Etiqueta(nombre=nombre)
        session.add(nueva)
        session.commit()
    return RedirectResponse("/admin_etiquetas", status_code=303)

@app.post("/admin_etiquetas/eliminar")
async def eliminar_etiqueta(id: int = Form(...)):
    with Session(engine) as session:
        etq = session.get(Etiqueta, id)
        if etq:
            session.delete(etq)
            session.commit()
    return RedirectResponse("/admin_etiquetas", status_code=303)


# Sirve archivos estáticos (CSS y JS)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/imagenes_aprobadas", StaticFiles(directory="imagenes_aprobadas"), name="imagenes")

# Plantillas HTML
templates = Jinja2Templates(directory="templates")

@app.get("/ver_publicaciones", response_class=HTMLResponse)
def ver_publicaciones(request: Request):
    return templates.TemplateResponse("publicaciones.html", {"request": request})

@app.get("/publicador", response_class=HTMLResponse)
def publicador(request: Request):
    return templates.TemplateResponse("publicador.html", {"request": request})

@app.get("/admin", response_class=HTMLResponse)
def ver_admin(request: Request):
    return templates.TemplateResponse("admin_panel.html", {"request": request})
