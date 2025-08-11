export const productionConfig = {
  cors: {
    origin: ['https://itsz.hnee.de'],
    credentials: true
  },
  ssl: {
    minVersion: 'TLSv1.3',
    ciphers: 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384'
  }
};