import { green } from 'colors/safe';
import isEmpty from 'lodash.isempty';
import { AwsCredentialIdentity } from '@aws-sdk/types';
import { fromIni } from '@aws-sdk/credential-providers';
import { SSO } from '@aws-sdk/client-sso';

import { tokenCodeFn, getConfigFilename, getSSOCachePath } from './utils';
import { ProfileCredentialsCache } from './profile-credentials-cache';
import { ProfileConfig } from './profile-config';
import { SSOLoginCache } from './sso-login-cache';

const profileCredentialsCache = new ProfileCredentialsCache();

enum ModeName {
  ForReading,
  ForWriting,
}

export class IniFileCredentialProviderSource
  implements IniFileCredentialProviderSource
{
  private profileConfig: ProfileConfig;
  private ssoLoginCache: SSOLoginCache;

  constructor(
    public readonly name: string,
    private readonly profiles: { [key: string]: string },
    private readonly filename: string,
  ) {
    this.profileConfig = new ProfileConfig(getConfigFilename());
    this.ssoLoginCache = new SSOLoginCache(getSSOCachePath());
  }

  public canProvideCredentials(accountId: string): Promise<boolean> {
    return Promise.resolve(
      Object.prototype.hasOwnProperty.call(this.profiles, accountId),
    );
  }

  public async getProvider(
    accountId: string,
    mode: ModeName,
  ): Promise<AwsCredentialIdentity> {
    const profile = this.profiles[accountId];

    console.log('\n');
    console.log(
      ` 🚀  Using profile ${green(profile)} for account ${green(
        accountId,
      )} in mode ${green(ModeName[mode])}`,);
    console.log('\n');

    let credentials = profileCredentialsCache.get(profile);

    if (!credentials) {
      if (this.profileConfig.isSSOProfile(profile)) {
        const ssoProfile = this.profileConfig.getProfile(profile);
        const ssoSettings = this.profileConfig.getSSOSettings(profile);
        const ssoLogin = this.ssoLoginCache.getCachedLogin(ssoSettings);

        const ssoClient = new SSO({ region: ssoSettings.sso_region });

        const response = await ssoClient.getRoleCredentials({
          accessToken: ssoLogin.accessToken,
          accountId: ssoProfile.sso_account_id,
          roleName: ssoProfile.sso_role_name,
        });

        const roleCredentials = response.roleCredentials;

        if (
          !roleCredentials?.accessKeyId ||
          !roleCredentials.secretAccessKey ||
          !roleCredentials.sessionToken
        )
          throw new Error('Invalid roleCredentials!');

        credentials = {
          accessKeyId: roleCredentials.accessKeyId,
          secretAccessKey: roleCredentials.secretAccessKey,
          sessionToken: roleCredentials.sessionToken,
          expiration: roleCredentials.expiration 
            ? new Date(roleCredentials.expiration) 
            : undefined
        };
      } else {
        // In SDK v3, fromIni returns a credential provider function
        const credentialProvider = fromIni({
          profile,
          filepath: this.filename,
          mfaCodeProvider: tokenCodeFn
        });
        
        // Execute the provider function to get credentials
        credentials = await credentialProvider();
      }

      profileCredentialsCache.set(profile, credentials);
    }

    return Promise.resolve(credentials);
  }

  public isAvailable(): Promise<boolean> {
    if (this.filename && !isEmpty(this.profiles)) return Promise.resolve(true);

    return Promise.resolve(false);
  }
}