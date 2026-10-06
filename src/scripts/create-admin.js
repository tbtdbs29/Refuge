// Creates an administrator account from the command line.
// Usage: npm run create-admin -- "Prénom Nom" email@example.org "mot de passe"
import { closeDb } from '../db/index.js';
import { userSchema, validate } from '../schemas/index.js';
import { userService } from '../services/userService.js';

const [name, email, password] = process.argv.slice(2);
try {
  const data = validate(userSchema, { name, email, password, role: 'admin' });
  if (!data.password) throw new Error('A password of at least 10 characters is required.');
  await userService.create(data);
  console.log(`Administrator account created for ${data.email}.`);
} catch (error) {
  console.error(error.details ? JSON.stringify(error.details) : error.message);
  process.exitCode = 1;
} finally {
  closeDb();
}
