const bcrypt = require('bcrypt');

const hashPassword = async (plainPassword) => {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
  return hashedPassword;
};

// Example usage:
const password = 'admin123';
hashPassword(password).then((hashed) => console.log(hashed));
