export const buildTaricUrl = (hsCode: string) =>
  `https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Taric=${encodeURIComponent(hsCode)}`;

export const buildSwissTaresUrl = (hsCode: string) =>
  `https://xtares.admin.ch/tares/login/loginFormFiller.do?hs=${encodeURIComponent(hsCode)}`;
