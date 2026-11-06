package br.com.argousForms.protocolos;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.model.negocio.processos.ProtocoloGestorElegivelNegocio;
import br.com.argousForms.model.persistencia.processos.ProtocoloGestorElegivel;
import br.com.argousForms.model.persistencia.processos.ProtocoloGestorElegivelLocalizador;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;

public final class GestoresProtocoloService {

	public JSONObject salvar( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, JSONArray regras ) throws Exception {

		if( !usuario.papeis().contains( "CRIADOR_DE_PROTOCOLOS" ) && !usuario.papeis().contains( "MODELADOR" ) ) throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode editar Protocolos." );
		if( regras == null ) throw new ArgousFormsApiException( 400, "REGRAS_INVALIDAS", "Informe as regras de gestores elegíveis." );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				UUID idVersao;
				String sql = "select v.ID_PROTOCOLO_VERSAO from Processos.PROTOCOLO_VERSOES v join Processos.PROTOCOLOS p on p.ID_PROTOCOLO = v.ID_PROTOCOLO where p.ID_PROTOCOLO = ? and p.ID_USUARIO_CRIADOR = ? and v.ID_USUARIO_RESPONSAVEL = ? and v.NR_VERSAO = -1 for update of v";
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
					consulta.setObject( 1, idProtocolo );
					consulta.setObject( 2, usuario.idUsuario() );
					consulta.setObject( 3, usuario.idUsuario() );
					try ( ResultSet linha = consulta.executeQuery() ) {
						if( !linha.next() ) throw new ArgousFormsApiException( 404, "RASCUNHO_NAO_ENCONTRADO", "Rascunho indisponível para edição." );
						idVersao = linha.getObject( 1, UUID.class );
					}
				}

				List<UUID> antigos = new ArrayList<>();
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_GESTOR_ELEGIVEL from Processos.PROTOCOLO_GESTORES_ELEGIVEIS where ID_PROTOCOLO_VERSAO = ?" ) ) {
					consulta.setObject( 1, idVersao );
					try ( ResultSet linhas = consulta.executeQuery() ) { while( linhas.next() ) antigos.add( linhas.getObject( 1, UUID.class ) ); }
				}
				for( UUID id : antigos ) new ProtocoloGestorElegivelNegocio( conexao, ProtocoloGestorElegivelLocalizador.buscaProtocoloGestorElegivel( conexao, id ) ).exclui();

				for( int i = 0; i < regras.length(); i++ ) {
					JSONObject regra = regras.getJSONObject( i );
					ProtocoloGestorElegivel gestor = new ProtocoloGestorElegivel();
					gestor.setIdGestorElegivel( UUID.randomUUID() );
					gestor.setIdProtocoloVersao( idVersao );
					if( preenchido( regra, "idUsuarioSistema" ) ) gestor.setIdUsuarioSistema( UUID.fromString( regra.getString( "idUsuarioSistema" ) ) );
					if( preenchido( regra, "idGrupo" ) ) gestor.setIdGrupo( Integer.valueOf( regra.getString( "idGrupo" ) ) );
					if( preenchido( regra, "cdTagGrupo" ) ) gestor.setCdTagGrupo( regra.getString( "cdTagGrupo" ) );
					if( preenchido( regra, "cdTagUsuario" ) ) gestor.setCdTagUsuario( regra.getString( "cdTagUsuario" ) );
					if( preenchido( regra, "cdTagVinculo" ) ) gestor.setCdTagVinculo( regra.getString( "cdTagVinculo" ) );
					if( gestor.getIdUsuarioSistema() == null && gestor.getIdGrupo() == null && gestor.getCdTagGrupo() == null && gestor.getCdTagUsuario() == null && gestor.getCdTagVinculo() == null ) {
						throw new ArgousFormsApiException( 400, "REGRA_VAZIA", "Uma regra de gestor não pode ficar vazia." );
					}
					new ProtocoloGestorElegivelNegocio( conexao, gestor ).insere();
				}
				conexao.commit();
				return new JSONObject().put( "quantidade", regras.length() );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private boolean preenchido( JSONObject regra, String campo ) {

		return !regra.optString( campo, "" ).isBlank();
	}
}
