import * as Localization from 'expo-localization';

const translations: Record<string, Record<string, string>> = {
  en: {
    // App
    app_name: 'OmniSwap',
    
    // Wallet
    wallet: 'Wallet',
    wallets: 'Wallets',
    balance: 'Balance',
    total_balance: 'Total Balance',
    tokens: 'Tokens',
    
    // Auth
    unlock_wallet: 'Unlock Wallet',
    use_biometrics: 'Use biometrics to unlock',
    use_pin: 'Use PIN instead',
    authenticate: 'Authenticate',
    unlock: 'Unlock',
    
    // Actions
    send: 'Send',
    receive: 'Receive',
    buy: 'Buy',
    swap: 'Swap',
    copy: 'Copy',
    paste: 'Paste',
    cancel: 'Cancel',
    confirm: 'Confirm',
    continue: 'Continue',
    done: 'Done',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    next: 'Next',
    skip: 'Skip',
    
    // Wallet Management
    create_wallet: 'Create Wallet',
    import_wallet: 'Import Wallet',
    add_wallet: 'Add Wallet',
    wallet_created: 'Wallet created successfully',
    wallet_imported: 'Wallet imported successfully',
    wallet_unlocked: 'Wallet unlocked',
    backup_phrase: 'Backup Phrase',
    recovery_phrase: 'Recovery Phrase',
    enter_password: 'Enter Password',
    create_password: 'Create Password',
    confirm_password: 'Confirm Password',
    
    // Search
    search: 'Search',
    search_tokens: 'Search tokens...',
    
    // Swap
    you_pay: 'You Pay',
    you_receive: 'You Receive',
    variable_rate: 'Variable Rate',
    fixed_rate: 'Fixed Rate',
    provider: 'Provider',
    see_offers: 'See All Offers',
    slippage: 'Slippage',
    rate_note: 'Rate may change during transaction',
    select_token: 'Select Token',
    enter_amount: 'Enter amount',
    insufficient_liquidity: 'Insufficient liquidity',
    fetching_quote: 'Fetching quote...',
    best_rate: 'Best Rate',
    
    // Messages
    address_copied: 'Address copied to clipboard',
    copied: 'Copied!',
    error: 'Error',
    success: 'Success',
    loading: 'Loading...',
    
    // Errors
    invalid_address: 'Invalid address',
    insufficient_balance: 'Insufficient balance',
    transaction_failed: 'Transaction failed',
    network_error: 'Network error',
    
    // Settings
    settings: 'Settings',
    language: 'Language',
    currency: 'Currency',
    security: 'Security',
    about: 'About',
    
    // Networks
    network: 'Network',
    networks: 'Networks',
    mainnet: 'Mainnet',
    testnet: 'Testnet',
  },
  
  fr: {
    // App
    app_name: 'OmniSwap',
    
    // Wallet
    wallet: 'Portefeuille',
    wallets: 'Portefeuilles',
    balance: 'Solde',
    total_balance: 'Solde Total',
    tokens: 'Jetons',
    
    // Auth
    unlock_wallet: 'Déverrouiller',
    use_biometrics: 'Utiliser la biométrie',
    use_pin: 'Utiliser le PIN',
    authenticate: 'Authentifier',
    unlock: 'Déverrouiller',
    
    // Actions
    send: 'Envoyer',
    receive: 'Recevoir',
    buy: 'Acheter',
    swap: 'Échanger',
    copy: 'Copier',
    paste: 'Coller',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    continue: 'Continuer',
    done: 'Terminé',
    save: 'Enregistrer',
    delete: 'Supprimer',
    edit: 'Modifier',
    back: 'Retour',
    next: 'Suivant',
    skip: 'Passer',
    
    // Wallet Management
    create_wallet: 'Créer un portefeuille',
    import_wallet: 'Importer un portefeuille',
    add_wallet: 'Ajouter un portefeuille',
    wallet_created: 'Portefeuille créé avec succès',
    wallet_imported: 'Portefeuille importé avec succès',
    wallet_unlocked: 'Portefeuille déverrouillé',
    backup_phrase: 'Phrase de sauvegarde',
    recovery_phrase: 'Phrase de récupération',
    enter_password: 'Entrer le mot de passe',
    create_password: 'Créer un mot de passe',
    confirm_password: 'Confirmer le mot de passe',
    
    // Search
    search: 'Rechercher',
    search_tokens: 'Rechercher des jetons...',
    
    // Swap
    you_pay: 'Vous payez',
    you_receive: 'Vous recevez',
    variable_rate: 'Taux variable',
    fixed_rate: 'Taux fixe',
    provider: 'Fournisseur',
    see_offers: 'Voir toutes les offres',
    slippage: 'Glissement',
    rate_note: 'Le taux peut changer pendant la transaction',
    select_token: 'Sélectionner un jeton',
    enter_amount: 'Entrer le montant',
    insufficient_liquidity: 'Liquidité insuffisante',
    fetching_quote: 'Récupération du devis...',
    best_rate: 'Meilleur taux',
    
    // Messages
    address_copied: 'Adresse copiée',
    copied: 'Copié!',
    error: 'Erreur',
    success: 'Succès',
    loading: 'Chargement...',
    
    // Errors
    invalid_address: 'Adresse invalide',
    insufficient_balance: 'Solde insuffisant',
    transaction_failed: 'Transaction échouée',
    network_error: 'Erreur réseau',
    
    // Settings
    settings: 'Paramètres',
    language: 'Langue',
    currency: 'Devise',
    security: 'Sécurité',
    about: 'À propos',
    
    // Networks
    network: 'Réseau',
    networks: 'Réseaux',
    mainnet: 'Principal',
    testnet: 'Test',
  },
  
  es: {
    app_name: 'OmniSwap',
    wallet: 'Cartera',
    wallets: 'Carteras',
    balance: 'Saldo',
    total_balance: 'Saldo Total',
    tokens: 'Tokens',
    unlock_wallet: 'Desbloquear Cartera',
    use_biometrics: 'Usar biometría',
    use_pin: 'Usar PIN',
    authenticate: 'Autenticar',
    unlock: 'Desbloquear',
    send: 'Enviar',
    receive: 'Recibir',
    buy: 'Comprar',
    swap: 'Intercambiar',
    copy: 'Copiar',
    paste: 'Pegar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    continue: 'Continuar',
    done: 'Hecho',
    save: 'Guardar',
    delete: 'Eliminar',
    edit: 'Editar',
    back: 'Atrás',
    next: 'Siguiente',
    skip: 'Omitir',
    create_wallet: 'Crear Cartera',
    import_wallet: 'Importar Cartera',
    add_wallet: 'Añadir Cartera',
    wallet_created: 'Cartera creada con éxito',
    wallet_imported: 'Cartera importada con éxito',
    wallet_unlocked: 'Cartera desbloqueada',
    backup_phrase: 'Frase de respaldo',
    recovery_phrase: 'Frase de recuperación',
    enter_password: 'Introducir contraseña',
    create_password: 'Crear contraseña',
    confirm_password: 'Confirmar contraseña',
    search: 'Buscar',
    search_tokens: 'Buscar tokens...',
    you_pay: 'Pagas',
    you_receive: 'Recibes',
    variable_rate: 'Tasa variable',
    fixed_rate: 'Tasa fija',
    provider: 'Proveedor',
    see_offers: 'Ver todas las ofertas',
    slippage: 'Deslizamiento',
    rate_note: 'La tasa puede cambiar durante la transacción',
    select_token: 'Seleccionar token',
    enter_amount: 'Introducir cantidad',
    insufficient_liquidity: 'Liquidez insuficiente',
    fetching_quote: 'Obteniendo cotización...',
    best_rate: 'Mejor tasa',
    address_copied: 'Dirección copiada',
    copied: '¡Copiado!',
    error: 'Error',
    success: 'Éxito',
    loading: 'Cargando...',
    invalid_address: 'Dirección inválida',
    insufficient_balance: 'Saldo insuficiente',
    transaction_failed: 'Transacción fallida',
    network_error: 'Error de red',
    settings: 'Configuración',
    language: 'Idioma',
    currency: 'Moneda',
    security: 'Seguridad',
    about: 'Acerca de',
    network: 'Red',
    networks: 'Redes',
    mainnet: 'Principal',
    testnet: 'Prueba',
  },
  
  zh: {
    app_name: 'OmniSwap',
    wallet: '钱包',
    wallets: '钱包',
    balance: '余额',
    total_balance: '总余额',
    tokens: '代币',
    unlock_wallet: '解锁钱包',
    use_biometrics: '使用生物识别解锁',
    use_pin: '使用PIN码',
    authenticate: '验证',
    unlock: '解锁',
    send: '发送',
    receive: '接收',
    buy: '购买',
    swap: '兑换',
    copy: '复制',
    paste: '粘贴',
    cancel: '取消',
    confirm: '确认',
    continue: '继续',
    done: '完成',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    back: '返回',
    next: '下一步',
    skip: '跳过',
    create_wallet: '创建钱包',
    import_wallet: '导入钱包',
    add_wallet: '添加钱包',
    wallet_created: '钱包创建成功',
    wallet_imported: '钱包导入成功',
    wallet_unlocked: '钱包已解锁',
    backup_phrase: '备份助记词',
    recovery_phrase: '恢复助记词',
    enter_password: '输入密码',
    create_password: '创建密码',
    confirm_password: '确认密码',
    search: '搜索',
    search_tokens: '搜索代币...',
    you_pay: '支付',
    you_receive: '收到',
    variable_rate: '浮动汇率',
    fixed_rate: '固定汇率',
    provider: '提供商',
    see_offers: '查看所有报价',
    slippage: '滑点',
    rate_note: '交易期间汇率可能变化',
    select_token: '选择代币',
    enter_amount: '输入金额',
    insufficient_liquidity: '流动性不足',
    fetching_quote: '获取报价中...',
    best_rate: '最佳汇率',
    address_copied: '地址已复制',
    copied: '已复制！',
    error: '错误',
    success: '成功',
    loading: '加载中...',
    invalid_address: '地址无效',
    insufficient_balance: '余额不足',
    transaction_failed: '交易失败',
    network_error: '网络错误',
    settings: '设置',
    language: '语言',
    currency: '货币',
    security: '安全',
    about: '关于',
    network: '网络',
    networks: '网络',
    mainnet: '主网',
    testnet: '测试网',
  },
};

let currentLocale = 'en';

try {
  const deviceLocale = Localization.locale;
  if (deviceLocale) {
    const langCode = deviceLocale.split('-')[0].toLowerCase();
    if (translations[langCode]) {
      currentLocale = langCode;
    }
  }
} catch (error) {
  console.warn('[i18n] Failed to get device locale, using default:', error);
  currentLocale = 'en';
}

export const t = (key: string): string => {
  const translation = translations[currentLocale]?.[key];
  if (translation) return translation;
  
  const fallback = translations['en']?.[key];
  if (fallback) return fallback;
  
  console.warn(`[i18n] Missing translation: ${currentLocale}.${key}`);
  return key;
};

export const setLocale = (locale: string): void => {
  const langCode = locale.split('-')[0].toLowerCase();
  if (translations[langCode]) {
    currentLocale = langCode;
  }
};

export const getLocale = (): string => currentLocale;
export const getAvailableLocales = (): string[] => Object.keys(translations);
