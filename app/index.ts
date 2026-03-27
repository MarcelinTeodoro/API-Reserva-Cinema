import 'dotenv/config';
import { start } from './server';

const portaEnv = Number(process.env.PORT);
const PORTA = Number.isInteger(portaEnv) && portaEnv > 0 ? portaEnv : 3333;

start(PORTA);
