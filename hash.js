const bcrypt = require('bcrypt');

const hashPassword = async (plainPassword) => {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
  return hashedPassword;
};

// TEst the function
const password = 'admin';
hashPassword(password).then((hashed) => console.log(hashed));
