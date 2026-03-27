// Integração com API do Grupo C (Pagamentos)
// TODO: Substituir URL pela URL real do Grupo C em .env

const GRUPO_C_URL = process.env.GRUPO_C_URL || 'http://localhost:3000/pagamentos';

export interface DadosPagamento {
  id_reserva: string;
  id_usuario: string;
  id_filme: string;
  id_sala: string;
  horario: string;
  assento_reservado: string;
  criado_em: string;
  expira_em: string;
}

export interface ErroGrupoC {
  erro: string;
  mensagem?: string;
}

export async function enviarParaPagamento(dados: DadosPagamento): Promise<{ sucesso: boolean; erro?: ErroGrupoC }> {
  try {
    const response = await fetch(GRUPO_C_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });

    // Se a resposta não é sucesso, significa que o pagamento foi recusado
    if (!response.ok) {
      const erro = await response.json() as ErroGrupoC;
      return { sucesso: false, erro };
    }

    // Sucesso: Grupo C não retorna body
    return { sucesso: true };
  } catch (err) {
    // Erro na comunicação
    return {
      sucesso: false,
      erro: {
        erro: 'ERRO_COMUNICACAO',
        mensagem: err instanceof Error ? err.message : 'Erro ao comunicar com Grupo C',
      },
    };
  }
}
