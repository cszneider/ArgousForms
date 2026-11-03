package br.com.argousForms.protocolos;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.model.negocio.processos.EncaminhamentoNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloEtapaDestinatarioNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloEtapaNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloVersaoNegocio;
import br.com.argousForms.model.persistencia.processos.Encaminhamento;
import br.com.argousForms.model.persistencia.processos.EncaminhamentoLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloEtapa;
import br.com.argousForms.model.persistencia.processos.ProtocoloEtapaDestinatario;
import br.com.argousForms.model.persistencia.processos.ProtocoloEtapaDestinatarioLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloEtapaLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloVersao;
import br.com.argousForms.model.persistencia.processos.ProtocoloVersaoLocalizador;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.util.QtData;

public final class FluxoProtocolosService {

	public JSONObject catalogo( AutenticacaoLocalService.Usuario usuario ) throws Exception {

		exigirCriador( usuario );
		JSONObject catalogo = new JSONObject().put( "usuarios", new JSONArray() ).put( "grupos", new JSONArray() ).put( "tags", new JSONArray() );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_USUARIO_SISTEMA, DS_NOME, DS_EMAIL from Cadastro.USUARIOS_SISTEMA where DT_EXCLUSAO is null order by DS_NOME" ); ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) catalogo.getJSONArray( "usuarios" ).put( new JSONObject().put( "id", linhas.getString( 1 ) ).put( "nome", linhas.getString( 2 ) ).put( "email", linhas.getString( 3 ) ) );
			}
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_GRUPO, DS_NOME_GRUPO from Cadastro.GRUPOS where SN_ATIVO = true order by DS_NOME_GRUPO" ); ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) catalogo.getJSONArray( "grupos" ).put( new JSONObject().put( "id", linhas.getInt( 1 ) ).put( "nome", linhas.getString( 2 ) ) );
			}
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select CD_TAG, DS_TAG, SN_GRUPO, SN_USUARIO, SN_VINCULO from Cadastro.TAGS where SN_ATIVA = true order by CD_TAG" ); ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) catalogo.getJSONArray( "tags" ).put( new JSONObject().put( "codigo", linhas.getString( 1 ) ).put( "descricao", linhas.getString( 2 ) )
					.put( "grupo", linhas.getBoolean( 3 ) ).put( "usuario", linhas.getBoolean( 4 ) ).put( "vinculo", linhas.getBoolean( 5 ) ) );
			}
		}
		return catalogo;
	}

	public JSONObject salvar( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, JSONArray etapasInformadas, JSONArray ligacoesInformadas, String inicio ) throws Exception {

		exigirCriador( usuario );
		if( etapasInformadas == null || ligacoesInformadas == null || etapasInformadas.length() == 0 || inicio == null ) {
			throw invalido( "Informe as etapas, as ligações e a etapa inicial do fluxo." );
		}
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				UUID idVersao = exigirRascunho( conexao, usuario, idProtocolo );
				try ( PreparedStatement bloqueio = conexao.getConnection().prepareStatement( "select ID_PROTOCOLO_VERSAO from Processos.PROTOCOLO_VERSOES where ID_PROTOCOLO_VERSAO = ? for update" ) ) {
					bloqueio.setObject( 1, idVersao );
					try ( ResultSet linha = bloqueio.executeQuery() ) { if( !linha.next() ) throw invalido( "Rascunho indisponível." ); }
				}
				Map<String, UUID> ids = new HashMap<>();
				Set<UUID> formularios = selecionarUuids( conexao, "select ID_FORMULARIO from Processos.FORMULARIOS where ID_PROTOCOLO_VERSAO = ?", idVersao );
				Set<UUID> modelos = selecionarUuids( conexao, "select ID_PROTOCOLO_DOCUMENTO_VERSAO from Processos.PROTOCOLO_VERSAO_DOCUMENTOS where ID_PROTOCOLO_VERSAO = ?", idVersao );
				List<JSONObject> etapas = new ArrayList<>();
				for( int i = 0; i < etapasInformadas.length(); i++ ) {
					JSONObject etapa = etapasInformadas.optJSONObject( i );
					if( etapa == null || etapa.optString( "id" ).isBlank() ) throw invalido( "Etapa sem identificador." );
					if( ids.putIfAbsent( etapa.getString( "id" ), uuidOuNovo( etapa.getString( "id" ) ) ) != null ) throw invalido( "Etapa repetida no fluxo." );
					String titulo = etapa.optString( "titulo", "" ).strip();
					if( titulo.isEmpty() || titulo.length() > 255 ) throw invalido( "Informe um título válido para cada etapa." );
					UUID formulario = uuidObrigatorio( etapa, "formularioId" );
					if( !formularios.contains( formulario ) ) throw invalido( "O formulário da etapa não pertence ao rascunho." );
					JSONArray documentos = etapa.optJSONArray( "documentos" );
					if( documentos == null ) documentos = new JSONArray();
					Set<UUID> escolhidos = new HashSet<>();
					for( int j = 0; j < documentos.length(); j++ ) {
						UUID modelo = uuid( documentos.optString( j ) );
						if( !modelos.contains( modelo ) || !escolhidos.add( modelo ) ) throw invalido( "Modelo de documento inválido ou repetido na etapa." );
					}
					etapas.add( etapa );
				}
				if( !ids.containsKey( inicio ) ) throw invalido( "A etapa inicial não pertence ao fluxo." );
				Map<String, List<String>> saidas = new HashMap<>();
				Set<String> pares = new HashSet<>();
				for( int i = 0; i < ligacoesInformadas.length(); i++ ) {
					JSONObject ligacao = ligacoesInformadas.optJSONObject( i );
					if( ligacao == null ) throw invalido( "Ligação inválida." );
					String origem = ligacao.optString( "origem" );
					String destino = ligacao.optString( "destino" );
					if( !ids.containsKey( origem ) || !ids.containsKey( destino ) || origem.equals( destino ) || !pares.add( origem + ":" + destino ) ) throw invalido( "Ligação inválida ou repetida." );
					saidas.computeIfAbsent( origem, chave -> new ArrayList<>() ).add( destino );
				}
				validarPercurso( ids.keySet(), saidas, inicio );
				substituirFluxo( conexao, idVersao, etapas, ids, saidas );
				ProtocoloVersao versao = ProtocoloVersaoLocalizador.buscaProtocoloVersao( conexao, idVersao );
				versao.setDtAlteracao( new QtData( Instant.now().toEpochMilli() ) );
				new ProtocoloVersaoNegocio( conexao, versao ).altera();
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
		return consultar( usuario, idProtocolo );
	}

	public JSONObject consultar( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo ) throws Exception {

		exigirCriador( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			UUID idVersao = exigirRascunho( conexao, usuario, idProtocolo );
			JSONArray etapas = new JSONArray();
			JSONArray ligacoes = new JSONArray();
			String inicio = null;
			Map<UUID, UUID> encaminhamentos = new HashMap<>();
			Set<String> destinos = new HashSet<>();
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_PROTOCOLO_ETAPA, ID_FORMULARIO, DS_TITULO, DS_OBSERVACOES, NR_POSICAO_X, NR_POSICAO_Y, TX_SCRIPT_INICIALIZACAO, TX_SCRIPT_FINALIZACAO, ID_ENCAMINHAMENTO, JS_GERACAO_DOCUMENTOS from Processos.PROTOCOLOS_ETAPAS where ID_PROTOCOLO_VERSAO = ? order by DS_TITULO" ) ) {
				consulta.setObject( 1, idVersao );
				try ( ResultSet linhas = consulta.executeQuery() ) {
					while( linhas.next() ) {
						UUID id = (UUID) linhas.getObject( 1 );
						JSONObject etapa = new JSONObject().put( "id", id.toString() ).put( "formularioId", linhas.getString( 2 ) ).put( "titulo", linhas.getString( 3 ) )
							.put( "descricao", linhas.getString( 4 ) == null ? "" : linhas.getString( 4 ) ).put( "x", linhas.getInt( 5 ) ).put( "y", linhas.getInt( 6 ) )
							.put( "scriptInicializacao", linhas.getString( 7 ) == null ? "" : linhas.getString( 7 ) ).put( "scriptFinalizacao", linhas.getString( 8 ) == null ? "" : linhas.getString( 8 ) )
							.put( "destinatarios", new JSONArray() ).put( "documentos", new JSONArray() );
						String js = linhas.getString( 10 );
						if( js != null ) {
							JSONArray automaticos = new JSONObject( js ).optJSONArray( "aoFinalizar" );
							if( automaticos != null ) etapa.put( "documentos", automaticos );
						}
						UUID encaminhamento = (UUID) linhas.getObject( 9 );
						if( encaminhamento != null ) encaminhamentos.put( id, encaminhamento );
						etapas.put( etapa );
					}
				}
			}
			for( int i = 0; i < etapas.length(); i++ ) {
				JSONObject etapa = etapas.getJSONObject( i );
				UUID id = uuid( etapa.getString( "id" ) );
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_USUARIO_SISTEMA, ID_GRUPO, CD_TAG_GRUPO, CD_TAG_USUARIO, CD_TAG_VINCULO from Processos.PROTOCOLO_ETAPA_DESTINATARIOS where ID_PROTOCOLO_ETAPA = ?" ) ) {
					consulta.setObject( 1, id );
					try ( ResultSet linhas = consulta.executeQuery() ) {
						while( linhas.next() ) etapa.getJSONArray( "destinatarios" ).put( new JSONObject()
							.put( "idUsuarioSistema", linhas.getString( 1 ) == null ? JSONObject.NULL : linhas.getString( 1 ) )
							.put( "idGrupo", linhas.getObject( 2 ) == null ? JSONObject.NULL : linhas.getInt( 2 ) )
							.put( "cdTagGrupo", linhas.getString( 3 ) == null ? JSONObject.NULL : linhas.getString( 3 ) )
							.put( "cdTagUsuario", linhas.getString( 4 ) == null ? JSONObject.NULL : linhas.getString( 4 ) )
							.put( "cdTagVinculo", linhas.getString( 5 ) == null ? JSONObject.NULL : linhas.getString( 5 ) ) );
					}
				}
				UUID atual = encaminhamentos.get( id );
				Set<UUID> visitados = new HashSet<>();
				while( atual != null && visitados.add( atual ) ) {
					try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_PROXIMA_ETAPA, ID_PROXIMO_ENCAMINHAMENTO from Processos.ENCAMINHAMENTOS where ID_ENCAMINHAMENTO = ? and ID_PROTOCOLO_VERSAO = ?" ) ) {
						consulta.setObject( 1, atual );
						consulta.setObject( 2, idVersao );
						try ( ResultSet linhas = consulta.executeQuery() ) {
							if( !linhas.next() ) throw invalido( "O fluxo contém um encaminhamento inexistente." );
							String destino = linhas.getString( 1 );
							ligacoes.put( new JSONObject().put( "origem", id.toString() ).put( "destino", destino ) );
							destinos.add( destino );
							atual = (UUID) linhas.getObject( 2 );
						}
					}
				}
			}
			for( int i = 0; i < etapas.length(); i++ ) {
				String id = etapas.getJSONObject( i ).getString( "id" );
				if( !destinos.contains( id ) ) { inicio = id; break; }
			}
			return new JSONObject().put( "etapas", etapas ).put( "ligacoes", ligacoes ).put( "inicio", inicio == null ? JSONObject.NULL : inicio );
		}
	}

	private void validarPercurso( Set<String> etapas, Map<String, List<String>> saidas, String inicio ) throws ArgousFormsApiException {

		Map<String, Integer> entradas = new HashMap<>();
		for( String etapa : etapas ) entradas.put( etapa, 0 );
		for( List<String> destinos : saidas.values() ) for( String destino : destinos ) entradas.put( destino, entradas.get( destino ) + 1 );
		if( entradas.get( inicio ) != 0 || entradas.values().stream().filter( quantidade -> quantidade == 0 ).count() != 1 ) {
			throw invalido( "O fluxo precisa ter uma única etapa inicial." );
		}
		List<String> fila = new ArrayList<>();
		fila.add( inicio );
		int visitadas = 0;
		for( int i = 0; i < fila.size(); i++ ) {
			visitadas++;
			for( String destino : saidas.getOrDefault( fila.get( i ), List.of() ) ) {
				int restantes = entradas.get( destino ) - 1;
				entradas.put( destino, restantes );
				if( restantes == 0 ) fila.add( destino );
			}
		}
		if( visitadas != etapas.size() ) throw invalido( "Conecte todas as etapas sem criar ciclos." );
	}

	private void substituirFluxo( Conexao conexao, UUID idVersao, List<JSONObject> etapas, Map<String, UUID> ids, Map<String, List<String>> saidas ) throws Exception {

		List<UUID> antigos = new ArrayList<>( selecionarUuids( conexao, "select ID_PROTOCOLO_ETAPA from Processos.PROTOCOLOS_ETAPAS where ID_PROTOCOLO_VERSAO = ?", idVersao ) );
		for( UUID id : antigos ) {
			for( UUID destinatario : selecionarUuids( conexao, "select ID_ETAPA_DESTINATARIO from Processos.PROTOCOLO_ETAPA_DESTINATARIOS where ID_PROTOCOLO_ETAPA = ?", id ) ) {
				new ProtocoloEtapaDestinatarioNegocio( conexao, ProtocoloEtapaDestinatarioLocalizador.buscaProtocoloEtapaDestinatario( conexao, destinatario ) ).exclui();
			}
			ProtocoloEtapa antiga = ProtocoloEtapaLocalizador.buscaProtocoloEtapa( conexao, id );
			if( antiga.getIdEncaminhamento() != null ) {
				antiga.setIdEncaminhamento( null );
				new ProtocoloEtapaNegocio( conexao, antiga ).altera();
			}
		}
		Set<UUID> caminhosAntigos = selecionarUuids( conexao, "select ID_ENCAMINHAMENTO from Processos.ENCAMINHAMENTOS where ID_PROTOCOLO_VERSAO = ?", idVersao );
		for( UUID id : caminhosAntigos ) {
			Encaminhamento caminho = EncaminhamentoLocalizador.buscaEncaminhamento( conexao, id );
			if( caminho.getIdProximoEncaminhamento() != null ) {
				caminho.setIdProximoEncaminhamento( null );
				new EncaminhamentoNegocio( conexao, caminho ).altera();
			}
		}
		for( UUID id : caminhosAntigos ) {
			new EncaminhamentoNegocio( conexao, EncaminhamentoLocalizador.buscaEncaminhamento( conexao, id ) ).exclui();
		}
		for( UUID id : antigos ) new ProtocoloEtapaNegocio( conexao, ProtocoloEtapaLocalizador.buscaProtocoloEtapa( conexao, id ) ).exclui();
		for( JSONObject dados : etapas ) {
			ProtocoloEtapa etapa = new ProtocoloEtapa();
			etapa.setIdProtocoloVersao( idVersao );
			etapa.setIdFormulario( uuidObrigatorio( dados, "formularioId" ) );
			etapa.setDsTitulo( dados.getString( "titulo" ).strip() );
			etapa.setDsObservacoes( vazioParaNulo( dados.optString( "descricao" ) ) );
			etapa.setNrPosicaoX( dados.optInt( "x" ) );
			etapa.setNrPosicaoY( dados.optInt( "y" ) );
			etapa.setTxScriptInicializacao( vazioParaNulo( dados.optString( "scriptInicializacao" ) ) );
			etapa.setTxScriptFinalizacao( vazioParaNulo( dados.optString( "scriptFinalizacao" ) ) );
			JSONArray documentos = dados.optJSONArray( "documentos" );
			if( documentos != null && documentos.length() > 0 ) {
				JSONArray versoes = new JSONArray();
				for( int i = 0; i < documentos.length(); i++ ) versoes.put( documentos.getString( i ) );
				etapa.setJsGeracaoDocumentos( new JSONObject().put( "aoFinalizar", versoes ).toString() );
			}
			new ProtocoloEtapaNegocio( conexao, etapa ).insere();
			ids.put( dados.getString( "id" ), etapa.getIdProtocoloEtapa() );
			JSONArray destinatarios = dados.optJSONArray( "destinatarios" );
			if( destinatarios != null ) for( int i = 0; i < destinatarios.length(); i++ ) inserirDestinatario( conexao, etapa.getIdProtocoloEtapa(), destinatarios.getJSONObject( i ) );
		}
		for( JSONObject dados : etapas ) {
			List<String> destinos = saidas.getOrDefault( dados.getString( "id" ), List.of() );
			UUID proximo = null;
			for( int i = destinos.size() - 1; i >= 0; i-- ) {
				Encaminhamento caminho = new Encaminhamento();
				caminho.setIdEncaminhamento( UUID.randomUUID() );
				caminho.setIdProtocoloVersao( idVersao );
				caminho.setTpEncaminhamento( "E" );
				caminho.setIdProximaEtapa( ids.get( destinos.get( i ) ) );
				caminho.setIdProximoEncaminhamento( proximo );
				new EncaminhamentoNegocio( conexao, caminho ).insere();
				proximo = caminho.getIdEncaminhamento();
			}
			if( proximo != null ) {
				ProtocoloEtapa etapa = ProtocoloEtapaLocalizador.buscaProtocoloEtapa( conexao, ids.get( dados.getString( "id" ) ) );
				etapa.setIdEncaminhamento( proximo );
				new ProtocoloEtapaNegocio( conexao, etapa ).altera();
			}
		}
	}

	private void inserirDestinatario( Conexao conexao, UUID idEtapa, JSONObject dados ) throws Exception {

		ProtocoloEtapaDestinatario destinatario = new ProtocoloEtapaDestinatario();
		destinatario.setIdProtocoloEtapa( idEtapa );
		if( temValor( dados, "idUsuarioSistema" ) ) destinatario.setIdUsuarioSistema( uuid( dados.getString( "idUsuarioSistema" ) ) );
		if( temValor( dados, "idGrupo" ) ) {
			try { destinatario.setIdGrupo( Integer.parseInt( dados.get( "idGrupo" ).toString() ) ); }
			catch ( NumberFormatException e ) { throw invalido( "Grupo inválido na regra de destinatários." ); }
		}
		if( temValor( dados, "cdTagGrupo" ) ) destinatario.setCdTagGrupo( dados.getString( "cdTagGrupo" ) );
		if( temValor( dados, "cdTagUsuario" ) ) destinatario.setCdTagUsuario( dados.getString( "cdTagUsuario" ) );
		if( temValor( dados, "cdTagVinculo" ) ) destinatario.setCdTagVinculo( dados.getString( "cdTagVinculo" ) );
		if( destinatario.getIdUsuarioSistema() == null && destinatario.getIdGrupo() == null && destinatario.getCdTagGrupo() == null && destinatario.getCdTagUsuario() == null && destinatario.getCdTagVinculo() == null ) throw invalido( "Destinatário vazio." );
		if( destinatario.getIdUsuarioSistema() != null && !existeAtivo( conexao, "select 1 from Cadastro.USUARIOS_SISTEMA where ID_USUARIO_SISTEMA = ? and DT_EXCLUSAO is null", destinatario.getIdUsuarioSistema() ) ) throw invalido( "Usuário inativo na regra de destinatários." );
		if( destinatario.getIdGrupo() != null && !existeAtivo( conexao, "select 1 from Cadastro.GRUPOS where ID_GRUPO = ? and SN_ATIVO = true", destinatario.getIdGrupo() ) ) throw invalido( "Grupo inativo na regra de destinatários." );
		new ProtocoloEtapaDestinatarioNegocio( conexao, destinatario ).insere();
	}

	private boolean existeAtivo( Conexao conexao, String sql, Object id ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, id );
			try ( ResultSet linhas = consulta.executeQuery() ) { return linhas.next(); }
		}
	}

	private UUID exigirRascunho( Conexao conexao, AutenticacaoLocalService.Usuario usuario, UUID idProtocolo ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select v.ID_PROTOCOLO_VERSAO from Processos.PROTOCOLO_VERSOES v join Processos.PROTOCOLOS p on p.ID_PROTOCOLO = v.ID_PROTOCOLO where p.ID_PROTOCOLO = ? and p.ID_USUARIO_CRIADOR = ? and v.NR_VERSAO = -1 and v.ID_USUARIO_RESPONSAVEL = ?" ) ) {
			consulta.setObject( 1, idProtocolo );
			consulta.setObject( 2, usuario.idUsuario() );
			consulta.setObject( 3, usuario.idUsuario() );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				if( !linhas.next() ) throw new ArgousFormsApiException( 404, "RASCUNHO_NAO_ENCONTRADO", "Rascunho não encontrado ou indisponível para edição." );
				return (UUID) linhas.getObject( 1 );
			}
		}
	}

	private Set<UUID> selecionarUuids( Conexao conexao, String sql, UUID parametro ) throws Exception {

		Set<UUID> valores = new HashSet<>();
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, parametro );
			try ( ResultSet linhas = consulta.executeQuery() ) { while( linhas.next() ) valores.add( (UUID) linhas.getObject( 1 ) ); }
		}
		return valores;
	}

	private UUID uuidObrigatorio( JSONObject dados, String chave ) throws ArgousFormsApiException { return uuid( dados.optString( chave ) ); }

	private UUID uuid( String valor ) throws ArgousFormsApiException {

		try { return UUID.fromString( valor ); }
		catch ( RuntimeException e ) { throw invalido( "Identificador inválido no fluxo." ); }
	}

	private UUID uuidOuNovo( String valor ) {

		try { return UUID.fromString( valor ); }
		catch ( IllegalArgumentException e ) { return UUID.randomUUID(); }
	}

	private String vazioParaNulo( String valor ) { return valor == null || valor.isBlank() ? null : valor; }

	private boolean temValor( JSONObject dados, String chave ) { return dados.has( chave ) && !dados.isNull( chave ) && !dados.optString( chave, "" ).isBlank(); }

	private ArgousFormsApiException invalido( String mensagem ) { return new ArgousFormsApiException( 400, "FLUXO_INVALIDO", mensagem ); }

	private void exigirCriador( AutenticacaoLocalService.Usuario usuario ) throws ArgousFormsApiException {

		if( !usuario.papeis().contains( "CRIADOR_DE_PROTOCOLOS" ) && !usuario.papeis().contains( "MODELADOR" ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode criar Protocolos." );
		}
	}
}
