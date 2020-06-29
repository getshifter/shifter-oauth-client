import { getToken, OAuth2Process } from '../src';

describe('#getToken', () => {
  it('successfully', async () => {
    jest
      .spyOn(OAuth2Process.prototype, 'authorize')
      .mockReturnValue(Promise.resolve());

    jest
      .spyOn(OAuth2Process.prototype, 'wait')
      .mockReturnValue(Promise.resolve());
    jest
      .spyOn(OAuth2Process.prototype, 'getTokens')
      // @ts-ignore
      .mockReturnValue({ idToken: 'token' });

    const result = await getToken();
    expect(result).toEqual({ idToken: 'token' });
  });
});
