import streamlit as st
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import pandas as pd

# Título
st.title("🛡️ SENTINEL - Moderación de Texto")

# Dataset más balanceado y variado
textos_apropiados = [
    "Hola, ¿cómo estás?", "Buen trabajo", "Gracias por tu ayuda", "Me gustó tu comentario",
    "Estoy de acuerdo contigo", "Excelente aporte", "Muy bien hecho", "Gracias por compartir",
    "Espero que tengas un buen día", "¡Qué buena noticia!", "Esto me sirvió mucho", "Te felicito",
    "Buen análisis", "Muy interesante", "Estoy impresionado", "Felicitaciones", "Hola", "Hola a todos",
    "Buenos días", "Buenas tardes", "Buenas noches", "Hola equipo", "Hola, comunidad", "Hola amigos"
]

textos_inapropiados = [
    "Eres un idiota", "Odio a todos", "Esto es basura", "Te voy a golpear", "Maldito seas",
    "Qué estúpido eres", "Te destruiré", "Idiota", "No vales nada", "Eres un inútil",
    "Esto es una porquería", "Lárgate de aquí", "Eres patético", "Te voy a matar",
    "Cierra la boca", "Asqueroso", "No sirves para nada", "Maldito", "Tonto", "Estúpido"
]

data = {
    "texto": textos_apropiados + textos_inapropiados,
    "etiqueta": [0]*len(textos_apropiados) + [1]*len(textos_inapropiados)
}

df = pd.DataFrame(data)

# División de datos
X_train, X_test, y_train, y_test = train_test_split(df["texto"], df["etiqueta"], test_size=0.2, random_state=42)

# Pipeline con RandomForest
pipeline = Pipeline([
    ("vect", CountVectorizer()),
    ("clf", RandomForestClassifier(n_estimators=1000, random_state=42))
])

pipeline.fit(X_train, y_train)

# Predicción y evaluación
y_pred = pipeline.predict(X_test)
reporte = classification_report(y_test, y_pred, target_names=["Apropiado", "Inapropiado"])

# Formulario
st.subheader("📥 Ingresa texto para analizar")
user_input = st.text_area("Texto a analizar", height=150)

if st.button("Analizar"):
    resultado = pipeline.predict([user_input])[0]
    label = "✅ Aprobado (Apropiado)" if resultado == 0 else "⚠️ Rechazado (Inapropiado)"
    st.markdown(f"### Resultado: {label}")

st.markdown("---")
st.subheader("📊 Evaluación del Modelo")
st.text(reporte)
st.markdown("---")
st.subheader("📚 Información del Dataset")
st.write(df.head(30))
st.markdown("---")
st.subheader("📈 Gráfico de Distribución de Etiquetas")
st.bar_chart(df["etiqueta"].value_counts(), use_container_width=True)
st.markdown("---")
st.subheader("🔍 Análisis de Texto")
st.write("El modelo ha sido entrenado con un conjunto de datos ampliado y etiquetado para detectar texto inapropiado. Se utilizó un clasificador RandomForest para lograr una alta precisión en la moderación de texto.")
st.markdown("---")
st.subheader("⚙️ Configuración del Modelo")
st.write("El modelo utiliza un pipeline que incluye un vectorizador de texto y un clasificador RandomForest. Se puede ajustar el número de estimadores y otros parámetros del clasificador para mejorar el rendimiento.")
