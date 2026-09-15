// Netlify Function: crea un usuario nuevo (Firebase Authentication +
// documento en Firestore) sin desloguear al administrador que lo pide.
//
// Por qué existe esta función: crear un usuario con el SDK de cliente
// (createUserWithEmailAndPassword) loguea automáticamente como ese usuario
// nuevo en el navegador, echando al administrador de su propia sesión. El
// Admin SDK, que solo puede correr en un entorno servidor como este, no
// tiene ese problema.
//
// Seguridad: valida el token de la persona que llama y exige que su
// documento en Firestore tenga rol "administrador" antes de crear a nadie.

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Método no permitido." };
  }

  try {
    // 1. Validar que quien llama esté autenticado y sea administrador.
    const tokenHeader = event.headers.authorization || "";
    const idToken = tokenHeader.replace("Bearer ", "");
    if (!idToken) {
      return { statusCode: 401, body: JSON.stringify({ error: "Falta el token de autenticación." }) };
    }

    const tokenDecodificado = await admin.auth().verifyIdToken(idToken);
    const solicitanteSnap = await db.collection("usuarios").doc(tokenDecodificado.uid).get();

    if (!solicitanteSnap.exists || solicitanteSnap.data().rol !== "administrador") {
      return { statusCode: 403, body: JSON.stringify({ error: "Solo un administrador puede crear usuarios." }) };
    }

    // 2. Validar los datos del nuevo usuario.
    const { nombre, email, contrasena, empresas, empresaPorDefecto, rol } = JSON.parse(event.body);

    if (!nombre || !email || !contrasena || !empresas?.length || !rol) {
      return { statusCode: 400, body: JSON.stringify({ error: "Faltan datos obligatorios." }) };
    }
    if (contrasena.length < 6) {
      return { statusCode: 400, body: JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres." }) };
    }

    // 3. Crear en Firebase Authentication.
    const usuarioCreado = await admin.auth().createUser({
      email,
      password: contrasena,
      displayName: nombre
    });

    // 4. Crear el documento espejo en Firestore (ver docs/modelo-datos.md).
    await db.collection("usuarios").doc(usuarioCreado.uid).set({
      uid: usuarioCreado.uid,
      nombre,
      email,
      empresas,
      empresaPorDefecto: empresaPorDefecto || empresas[0],
      rol,
      permisos: null,
      activo: true
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ uid: usuarioCreado.uid })
    };
  } catch (error) {
    console.error(error);

    if (error.code === "auth/email-already-exists") {
      return { statusCode: 409, body: JSON.stringify({ error: "Ya existe un usuario con ese email." }) };
    }

    return { statusCode: 500, body: JSON.stringify({ error: "No se pudo crear el usuario." }) };
  }
};
