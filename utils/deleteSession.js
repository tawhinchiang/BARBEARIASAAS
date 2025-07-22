const fs = require('fs');
const path = require('path');

function deleteSession(clientId) {
  const sessionName = `session-${clientId}`;
  const sessionDir = path.resolve(__dirname, '..', '.wwebjs_auth', sessionName);

  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    console.log(`🗑 Sessão '${sessionName}' excluída com sucesso em: ${sessionDir}`);
  } else {
    console.warn(`⚠️ Sessão '${sessionName}' não encontrada em: ${sessionDir}`);
  }
}

module.exports = deleteSession;
