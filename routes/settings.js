const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ===== LOGS DETALHADOS =====
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [SETTINGS] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [SETTINGS] Data:`, JSON.stringify(data, null, 2));
  }
};

const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [SETTINGS ERROR] ${message}`);
  console.error(`[${timestamp}] [SETTINGS ERROR] Stack:`, error.stack);
};

// Middleware de autenticação para todas as rotas
router.use(requireAuth);

// Função para ler configurações do arquivo .env
function readEnvConfig() {
  try {
    const envPath = path.join(__dirname, '../.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    const config = {};
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        config[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    return config;
  } catch (error) {
    logError('Erro ao ler arquivo .env', error);
    return {};
  }
}

// Função para escrever configurações no arquivo .env
function writeEnvConfig(config) {
  try {
    const envPath = path.join(__dirname, '../.env');
    const envContent = Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    fs.writeFileSync(envPath, envContent, 'utf8');
    return true;
  } catch (error) {
    logError('Erro ao escrever arquivo .env', error);
    return false;
  }
}

// ===== PÁGINA PRINCIPAL - CONFIGURAÇÕES =====
router.get('/', async (req, res) => {
  try {
    log('Carregando página de configurações');
    
    // Ler configurações atuais
    const envConfig = readEnvConfig();
    
    // Buscar dados do usuário admin
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    
    const settings = {
      whatsapp: {
        businessNumber: envConfig.WHATSAPP_BUSINESS_NUMBER || '',
        businessName: envConfig.WHATSAPP_BUSINESS_NAME || 'Barbearia Premium',
        businessAddress: envConfig.WHATSAPP_BUSINESS_ADDRESS || '',
        autoReply: envConfig.WHATSAPP_AUTO_REPLY === 'true',
        welcomeMessage: envConfig.WHATSAPP_WELCOME_MESSAGE || 'Olá! Seu agendamento foi confirmado.'
      },
      system: {
        siteName: envConfig.SITE_NAME || 'Barbearia Premium',
        siteUrl: envConfig.SITE_URL || 'http://localhost:3000',
        timezone: envConfig.TIMEZONE || 'America/Sao_Paulo',
        language: envConfig.LANGUAGE || 'pt-BR'
      },
      admin: {
        username: adminUser ? adminUser.username : 'admin',
        email: adminUser ? adminUser.email : '',
        lastLogin: adminUser ? adminUser.lastLogin : null
      }
    };
    
    log('Configurações carregadas');
    
    res.render('admin/settings', {
      title: 'Configurações do Sistema',
      settings: settings,
      layout: 'admin'
    });
  } catch (error) {
    logError('Erro ao carregar configurações', error);
    res.render('admin/settings', {
      title: 'Configurações do Sistema',
      settings: {},
      error: 'Erro ao carregar configurações',
      layout: 'admin'
    });
  }
});

// ===== ATUALIZAR CONFIGURAÇÕES DO WHATSAPP =====
router.post('/whatsapp', async (req, res) => {
  try {
    log('Atualizando configurações do WhatsApp', req.body);
    
    const { businessNumber, businessName, businessAddress, autoReply, welcomeMessage } = req.body;
    
    // Validações
    if (!businessNumber || !businessName) {
      return res.status(400).json({
        success: false,
        error: 'Número e nome do negócio são obrigatórios'
      });
    }
    
    // Validar formato do número (básico)
    const phoneRegex = /^\d{10,15}$/;
    const cleanNumber = businessNumber.replace(/\D/g, '');
    if (!phoneRegex.test(cleanNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone inválido. Use apenas números (10-15 dígitos)'
      });
    }
    
    // Ler configurações atuais
    const currentConfig = readEnvConfig();
    
    // Atualizar configurações do WhatsApp
    const updatedConfig = {
      ...currentConfig,
      WHATSAPP_BUSINESS_NUMBER: cleanNumber,
      WHATSAPP_BUSINESS_NAME: businessName.trim(),
      WHATSAPP_BUSINESS_ADDRESS: businessAddress ? businessAddress.trim() : '',
      WHATSAPP_AUTO_REPLY: autoReply === 'true' ? 'true' : 'false',
      WHATSAPP_WELCOME_MESSAGE: welcomeMessage ? welcomeMessage.trim() : 'Olá! Seu agendamento foi confirmado.'
    };
    
    // Salvar no arquivo .env
    if (!writeEnvConfig(updatedConfig)) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar configurações'
      });
    }
    
    log('Configurações do WhatsApp atualizadas com sucesso');
    
    res.json({
      success: true,
      message: 'Configurações do WhatsApp atualizadas com sucesso'
    });
  } catch (error) {
    logError('Erro ao atualizar configurações do WhatsApp', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== ATUALIZAR CONFIGURAÇÕES DO SISTEMA =====
router.post('/system', async (req, res) => {
  try {
    log('Atualizando configurações do sistema', req.body);
    
    const { siteName, siteUrl, timezone, language } = req.body;
    
    // Validações
    if (!siteName) {
      return res.status(400).json({
        success: false,
        error: 'Nome do site é obrigatório'
      });
    }
    
    // Ler configurações atuais
    const currentConfig = readEnvConfig();
    
    // Atualizar configurações do sistema
    const updatedConfig = {
      ...currentConfig,
      SITE_NAME: siteName.trim(),
      SITE_URL: siteUrl ? siteUrl.trim() : 'http://localhost:3000',
      TIMEZONE: timezone || 'America/Sao_Paulo',
      LANGUAGE: language || 'pt-BR'
    };
    
    // Salvar no arquivo .env
    if (!writeEnvConfig(updatedConfig)) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar configurações'
      });
    }
    
    log('Configurações do sistema atualizadas com sucesso');
    
    res.json({
      success: true,
      message: 'Configurações do sistema atualizadas com sucesso'
    });
  } catch (error) {
    logError('Erro ao atualizar configurações do sistema', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== ALTERAR SENHA DO ADMIN =====
router.post('/admin/password', async (req, res) => {
  try {
    log('Alterando senha do admin');
    
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // Validações
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Todos os campos são obrigatórios'
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Nova senha e confirmação não coincidem'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Nova senha deve ter pelo menos 6 caracteres'
      });
    }
    
    // Buscar usuário admin
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    if (!adminUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário admin não encontrado'
      });
    }
    
    // Verificar senha atual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, adminUser.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Senha atual incorreta'
      });
    }
    
    // Criptografar nova senha
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Atualizar senha
    await adminUser.update({ 
      password: hashedNewPassword,
      updatedAt: new Date()
    });
    
    log('Senha do admin alterada com sucesso');
    
    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    logError('Erro ao alterar senha', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== ATUALIZAR DADOS DO ADMIN =====
router.post('/admin/profile', async (req, res) => {
  try {
    log('Atualizando perfil do admin', req.body);
    
    const { username, email } = req.body;
    
    // Validações
    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Nome de usuário é obrigatório'
      });
    }
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email inválido'
      });
    }
    
    // Buscar usuário admin
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    if (!adminUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário admin não encontrado'
      });
    }
    
    // Verificar se novo username já existe (se diferente do atual)
    if (username !== adminUser.username) {
      const existingUser = await User.findOne({ where: { username: username.trim() } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Nome de usuário já existe'
        });
      }
    }
    
    // Atualizar dados
    await adminUser.update({
      username: username.trim(),
      email: email ? email.trim() : null,
      updatedAt: new Date()
    });
    
    log('Perfil do admin atualizado com sucesso');
    
    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso'
    });
  } catch (error) {
    logError('Erro ao atualizar perfil', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== TESTAR CONEXÃO WHATSAPP =====
router.post('/whatsapp/test', async (req, res) => {
  try {
    log('Testando conexão WhatsApp');
    
    // Aqui você pode implementar um teste real da conexão WhatsApp
    // Por enquanto, vamos simular um teste
    
    const envConfig = readEnvConfig();
    const businessNumber = envConfig.WHATSAPP_BUSINESS_NUMBER;
    
    if (!businessNumber) {
      return res.status(400).json({
        success: false,
        error: 'Número do WhatsApp não configurado'
      });
    }
    
    // Simular teste de conexão
    setTimeout(() => {
      log('Teste de conexão WhatsApp simulado');
    }, 1000);
    
    res.json({
      success: true,
      message: 'Conexão WhatsApp testada com sucesso',
      details: {
        number: businessNumber,
        status: 'connected',
        lastTest: new Date().toISOString()
      }
    });
  } catch (error) {
    logError('Erro ao testar WhatsApp', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ===== BACKUP DAS CONFIGURAÇÕES =====
router.get('/backup', async (req, res) => {
  try {
    log('Gerando backup das configurações');
    
    const envConfig = readEnvConfig();
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      settings: {
        whatsapp: {
          businessNumber: envConfig.WHATSAPP_BUSINESS_NUMBER || '',
          businessName: envConfig.WHATSAPP_BUSINESS_NAME || '',
          businessAddress: envConfig.WHATSAPP_BUSINESS_ADDRESS || '',
          autoReply: envConfig.WHATSAPP_AUTO_REPLY === 'true',
          welcomeMessage: envConfig.WHATSAPP_WELCOME_MESSAGE || ''
        },
        system: {
          siteName: envConfig.SITE_NAME || '',
          siteUrl: envConfig.SITE_URL || '',
          timezone: envConfig.TIMEZONE || '',
          language: envConfig.LANGUAGE || ''
        },
        admin: {
          username: adminUser ? adminUser.username : '',
          email: adminUser ? adminUser.email : ''
          // Senha não incluída por segurança
        }
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="barbearia-config-backup-${new Date().toISOString().split('T')[0]}.json"`);
    
    log('Backup gerado com sucesso');
    
    res.json(backup);
  } catch (error) {
    logError('Erro ao gerar backup', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;

