import * as path from 'path';
import * as os from 'os';
import inquirer from 'inquirer';

import { MfaTokenCache } from './mfa-token-cache';
import { PrecedenceProfileMapper } from './profile-mapper';

const tokenCache = new MfaTokenCache();

// Für SDK v3 muss die Token-Funktion eine Promise zurückgeben statt einen Callback zu verwenden
export const tokenCodeFn = async (mfaSerial: string): Promise<string> => {
  try {
    const { token } = await inquirer.prompt({
      name: 'token',
      type: 'input',
      default: '',
      message: `MFA token for ${mfaSerial}:`,
      validate: async (input) => {
        if (tokenCache.has(mfaSerial, input)) {
          return `Token ${input} has already been used in this run`;
        }

        tokenCache.set(mfaSerial, input);

        return true;
      },
    });
    return token;
  } catch (e) {
    console.error('error:', e);
    throw e; // In SDK v3 sollten wir den Fehler werfen statt ihn an einen Callback zu übergeben
  }
};

export const readProfiles = (): Record<string, string> => {
  const profileMapper = new PrecedenceProfileMapper();
  return profileMapper.resolve();
};

export const getSharedCredentialsFilename = (): string =>
  process.env.AWS_SHARED_CREDENTIALS_FILE ??
  path.join(os.homedir(), '.aws', 'credentials');

export const getConfigFilename = (): string =>
  process.env.AWS_CONFIG_FILE ?? path.join(os.homedir(), '.aws', 'config');

export const getSSOCachePath = (): string =>
  path.join(os.homedir(), '.aws', 'sso', 'cache');