const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('Uso: npm run hash -- <senha>');
  console.error('Exemplo: npm run hash -- minhaSenha123');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log(hash);
