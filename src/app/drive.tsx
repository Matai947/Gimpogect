import { ResponseType, makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { maybeCompleteAuthSession } from 'expo-web-browser';
import { Fragment, useEffect, useState } from 'react';
import { ActivityIndicator, Linking } from 'react-native';

import { Button, Card, Divider, ListRow, Screen, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';

maybeCompleteAuthSession();

// Web-type OAuth client from Google Cloud Console (see .env.example).
const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

type DriveFile = { id: string; name: string; mimeType: string; webViewLink?: string };

export default function DriveScreen() {
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      responseType: ResponseType.Token, // ponytail: implicit flow, token lives ~1h, no refresh; switch to code+PKCE via a backend if needed
      redirectUri: makeRedirectUri({ scheme: 'gymproject' }),
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type !== 'success') return;
    const token = response.params.access_token;
    fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=50&orderBy=modifiedTime desc&fields=files(id,name,mimeType,webViewLink)',
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then((r) => r.json())
      .then((j) => (j.error ? setError(j.error.message) : setFiles(j.files)))
      .catch((e) => setError(String(e)));
  }, [response]);

  return (
    <Screen contentStyle={{ padding: Spacing.three, gap: Spacing.three }}>
      <T type="title">Google Диск</T>
      {!CLIENT_ID && <T type="caption">Не задан EXPO_PUBLIC_GOOGLE_CLIENT_ID (см. .env.example)</T>}
      {!files && <Button title="Войти через Google" disabled={!request || !CLIENT_ID} onPress={() => promptAsync()} />}
      {response?.type === 'success' && !files && !error && <ActivityIndicator color={Colors.accent} />}
      {error && <T type="caption" color={Colors.danger}>{error}</T>}
      {files && (
        <Card padded={false}>
          {files.length === 0 && <T type="caption" style={{ padding: Spacing.three }}>Файлов нет</T>}
          {files.map((f, i) => (
            <Fragment key={f.id}>
              {i > 0 && <Divider />}
              <ListRow
                icon={f.mimeType.includes('folder') ? 'folder-outline' : 'document-outline'}
                title={f.name}
                onPress={f.webViewLink ? () => Linking.openURL(f.webViewLink!) : undefined}
              />
            </Fragment>
          ))}
        </Card>
      )}
    </Screen>
  );
}
