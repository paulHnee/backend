const bcrypt = require('bcrypt');
const readline = require('readline');

const hashPassword = async (plainPassword) => {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
  return hashedPassword;
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Please enter a password to hash: ', (password) => {
  hashPassword(password).then((hashed) => {
    console.log(`Hashed password: ${hashed}`);
    rl.close();
  });
});