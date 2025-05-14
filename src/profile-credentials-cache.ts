import { AwsCredentialIdentity } from '@aws-sdk/types';

export class ProfileCredentialsCache {
  private readonly cache: Record<string, AwsCredentialIdentity>;

  constructor() {
    this.cache = {};
  }

  public set(profile: string, credentials: AwsCredentialIdentity): void {
    this.cache[profile] = credentials;
  }

  public get(profile: string): AwsCredentialIdentity | undefined {
    return this.cache[profile];
  }

  public has(profile: string): boolean {
    return this.cache[profile] !== undefined;
  }
}
