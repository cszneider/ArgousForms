package br.com.argousForms.documentos;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.model.negocio.docs.PastaNegocio;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.util.QtData;

public final class DocumentosService {

	private static final String DESTINATARIO_PASTA = destinatario( "p", "1", "2", "3" );
	private static final String DESTINATARIO_ARQUIVO = destinatario( "p", "U", "G", "T" );

	private record Pasta( UUID id, UUID pai, String nome, String descricao ) {}
	private record Direitos( boolean leitura, boolean inclusao, boolean gestao ) {

		private boolean algum() {
			return leitura || inclusao || gestao;
		}
	}

	public JSONObject listarPasta( AutenticacaoLocalService.Usuario usuario, UUID idSolicitado ) throws Exception {

		if( !usuario.papeis().contains( "CONSULTA_DOCUMENTOS" ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode consultar documentos." );
		}

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			Map<UUID, Pasta> pastas = carregarPastas( conexao );
			Pasta raiz = raiz( pastas );
			if( raiz == null ) throw new ArgousFormsApiException( 503, "RAIZ_NAO_CONFIGURADA", "A pasta raiz ainda não foi configurada." );

			UUID idPasta = idSolicitado == null ? raiz.id() : idSolicitado;
			Pasta pasta = pastas.get( idPasta );
			if( pasta == null ) throw new ArgousFormsApiException( 404, "PASTA_NAO_ENCONTRADA", "Pasta não encontrada." );

			Set<UUID> leitura = carregarPermissoes( conexao, usuario.idUsuario(), "L" );
			Set<UUID> inclusao = carregarPermissoes( conexao, usuario.idUsuario(), "I" );
			Set<UUID> gestores = usuario.papeis().contains( "GESTAO_DOCUMENTOS" ) ? carregarGestores( conexao, usuario.idUsuario() ) : Set.of();
			Map<UUID, Direitos> direitos = new HashMap<>();
			for( UUID id : pastas.keySet() ) calcularDireitos( id, pastas, leitura, inclusao, gestores, direitos, new HashSet<>() );

			Set<UUID> visiveis = new HashSet<>();
			visiveis.add( raiz.id() );
			for( Map.Entry<UUID, Direitos> entrada : direitos.entrySet() ) {
				if( !entrada.getValue().algum() ) continue;
				UUID atual = entrada.getKey();
				while( atual != null && visiveis.add( atual ) ) {
					Pasta ancestral = pastas.get( atual );
					if( ancestral == null || ancestral.pai() == null ) break;
					atual = ancestral.pai();
				}
			}
			if( !visiveis.contains( idPasta ) ) throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Você não pode acessar esta pasta." );

			Direitos permissaoAtual = direitos.getOrDefault( idPasta, new Direitos( false, false, false ) );
			JSONArray caminho = caminho( pasta, pastas );
			JSONArray subpastas = new JSONArray();
			for( Pasta filha : pastas.values() ) {
			if( !idPasta.equals( filha.pai() ) || !visiveis.contains( filha.id() ) ) continue;
				Direitos permissaoFilha = direitos.get( filha.id() );
				subpastas.put( new JSONObject().put( "idPasta", filha.id().toString() ).put( "nome", filha.nome() )
					.put( "descricao", filha.descricao() == null ? JSONObject.NULL : filha.descricao() )
					.put( "podeLer", permissaoFilha.leitura() || permissaoFilha.gestao() )
					.put( "podeIncluir", permissaoFilha.inclusao() || permissaoFilha.gestao() ) );
			}

			JSONArray arquivos = carregarArquivos( conexao, idPasta, usuario.idUsuario(), permissaoAtual );
			JSONObject pastaJson = new JSONObject().put( "idPasta", pasta.id().toString() ).put( "nome", pasta.nome() )
				.put( "descricao", pasta.descricao() == null ? JSONObject.NULL : pasta.descricao() )
				.put( "podeLer", permissaoAtual.leitura() || permissaoAtual.gestao() )
				.put( "podeIncluir", permissaoAtual.inclusao() || permissaoAtual.gestao() )
				.put( "gestor", permissaoAtual.gestao() );
			return new JSONObject().put( "pasta", pastaJson ).put( "caminho", caminho ).put( "pastas", subpastas ).put( "arquivos", arquivos );
		} catch ( SQLException e ) {
			if( "42P01".equals( e.getSQLState() ) || "3F000".equals( e.getSQLState() ) ) {
				throw new ArgousFormsApiException( 503, "DOCUMENTOS_NAO_CONFIGURADOS", "As tabelas de documentos ainda não estão disponíveis." );
			}
			throw e;
		}
	}

	public JSONObject criarPasta( AutenticacaoLocalService.Usuario usuario, UUID idPai, String nomeInformado, String descricaoInformada ) throws Exception {

		if( !usuario.papeis().contains( "GESTAO_DOCUMENTOS" ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode administrar pastas." );
		}
		if( idPai == null ) throw new ArgousFormsApiException( 400, "PASTA_PAI_OBRIGATORIA", "Escolha a pasta onde a subpasta será criada." );

		String nome = nomeInformado == null ? "" : nomeInformado.strip();
		if( nome.isEmpty() || nome.length() > 255 ) {
			throw new ArgousFormsApiException( 400, "NOME_PASTA_INVALIDO", "Informe um nome de pasta com até 255 caracteres." );
		}
		String descricao = descricaoInformada == null || descricaoInformada.isBlank() ? null : descricaoInformada.strip();

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				Map<UUID, Pasta> pastas = carregarPastas( conexao );
				if( !pastas.containsKey( idPai ) ) throw new ArgousFormsApiException( 404, "PASTA_NAO_ENCONTRADA", "Pasta pai não encontrada." );
				Set<UUID> gestores = carregarGestores( conexao, usuario.idUsuario() );
				Map<UUID, Direitos> direitos = new HashMap<>();
				Direitos permissao = calcularDireitos( idPai, pastas, Set.of(), Set.of(), gestores, direitos, new HashSet<>() );
				if( !permissao.gestao() ) throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Você não é gestor desta pasta." );

				br.com.argousForms.model.persistencia.docs.Pasta nova = new br.com.argousForms.model.persistencia.docs.Pasta();
				QtData agora = new QtData( Instant.now().toEpochMilli() );
				nova.setIdPastaPai( idPai );
				nova.setDsNome( nome );
				nova.setDsDescricao( descricao );
				nova.setIdUsuarioCriou( usuario.idUsuario() );
				nova.setDtInclusao( agora );
				nova.setDtAlteracao( agora );
				new PastaNegocio( conexao, nova ).insere();
				conexao.commit();
				return new JSONObject().put( "idPasta", nova.getIdPasta().toString() ).put( "nome", nome );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	void exigirInclusao( Conexao conexao, AutenticacaoLocalService.Usuario usuario, UUID idPasta ) throws Exception {

		if( !usuario.papeis().contains( "EDITOR_DE_DOCUMENTOS" ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode enviar arquivos." );
		}
		Map<UUID, Pasta> pastas = carregarPastas( conexao );
		if( !pastas.containsKey( idPasta ) ) throw new ArgousFormsApiException( 404, "PASTA_NAO_ENCONTRADA", "Pasta não encontrada." );

		Set<UUID> inclusao = carregarPermissoes( conexao, usuario.idUsuario(), "I" );
		Set<UUID> gestores = usuario.papeis().contains( "GESTAO_DOCUMENTOS" ) ? carregarGestores( conexao, usuario.idUsuario() ) : Set.of();
		Direitos direitos = calcularDireitos( idPasta, pastas, Set.of(), inclusao, gestores, new HashMap<>(), new HashSet<>() );
		if( !direitos.inclusao() && !direitos.gestao() ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Você não pode incluir arquivos nesta pasta." );
		}
	}

	void exigirEdicaoArquivo( Conexao conexao, AutenticacaoLocalService.Usuario usuario, UUID idPasta, UUID idArquivo ) throws Exception {

		Map<UUID, Pasta> pastas = carregarPastas( conexao );
		Set<UUID> leitura = carregarPermissoes( conexao, usuario.idUsuario(), "L" );
		Set<UUID> gestores = usuario.papeis().contains( "GESTAO_DOCUMENTOS" ) ? carregarGestores( conexao, usuario.idUsuario() ) : Set.of();
		Direitos direitos = calcularDireitos( idPasta, pastas, leitura, Set.of(), gestores, new HashMap<>(), new HashSet<>() );
		if( direitos.gestao() ) return;

		String restricoes = "select count(*) from Docs.ARQUIVO_PERMISSOES where ID_ARQUIVO = ? "
			+ "and DT_INICIO <= CURRENT_TIMESTAMP and (DT_FIM is null or DT_FIM > CURRENT_TIMESTAMP)";
		int quantidade;
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( restricoes ) ) {
			consulta.setObject( 1, idArquivo );
			try ( ResultSet resultado = consulta.executeQuery() ) { resultado.next(); quantidade = resultado.getInt( 1 ); }
		}
		if( quantidade == 0 && direitos.leitura() ) return;
		if( quantidade > 0 ) {
			String sql = "select 1 from Docs.ARQUIVO_PERMISSOES p where p.ID_ARQUIVO = ? "
				+ "and p.DT_INICIO <= CURRENT_TIMESTAMP and (p.DT_FIM is null or p.DT_FIM > CURRENT_TIMESTAMP) "
				+ "and " + DESTINATARIO_ARQUIVO + " limit 1";
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
				consulta.setObject( 1, idArquivo );
				for( int indice = 2; indice <= 5; indice++ ) consulta.setObject( indice, usuario.idUsuario() );
				try ( ResultSet resultado = consulta.executeQuery() ) { if( resultado.next() ) return; }
			}
		}
		throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Você não pode adicionar uma versão a este arquivo." );
	}

	private static Map<UUID, Pasta> carregarPastas( Conexao conexao ) throws SQLException {

		Map<UUID, Pasta> pastas = new LinkedHashMap<>();
		String sql = "select ID_PASTA, ID_PASTA_PAI, DS_NOME, DS_DESCRICAO from Docs.PASTAS "
			+ "where DT_LIXEIRA is null and DT_EXCLUSAO is null order by lower(DS_NOME), ID_PASTA";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ); ResultSet resultado = consulta.executeQuery() ) {
			while( resultado.next() ) {
				UUID id = resultado.getObject( "ID_PASTA", UUID.class );
				pastas.put( id, new Pasta( id, resultado.getObject( "ID_PASTA_PAI", UUID.class ), resultado.getString( "DS_NOME" ), resultado.getString( "DS_DESCRICAO" ) ) );
			}
		}
		return pastas;
	}

	private static Pasta raiz( Map<UUID, Pasta> pastas ) {

		for( Pasta pasta : pastas.values() ) {
			if( pasta.pai() == null ) return pasta;
		}
		return null;
	}

	private static Set<UUID> carregarGestores( Conexao conexao, UUID usuario ) throws SQLException {

		Set<UUID> gestores = new HashSet<>();
		String sql = "select ID_PASTA from Docs.PASTA_GESTORES where ID_USUARIO_SISTEMA = ? and DT_EXCLUSAO is null";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, usuario );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				while( resultado.next() ) gestores.add( resultado.getObject( "ID_PASTA", UUID.class ) );
			}
		}
		return gestores;
	}

	private static Set<UUID> carregarPermissoes( Conexao conexao, UUID usuario, String acao ) throws SQLException {

		Set<UUID> pastas = new HashSet<>();
		String sql = "select distinct p.ID_PASTA from Docs.PASTA_PERMISSOES p where p.TP_ACAO = ? "
			+ "and p.DT_INICIO <= CURRENT_TIMESTAMP and (p.DT_FIM is null or p.DT_FIM > CURRENT_TIMESTAMP) "
			+ "and " + DESTINATARIO_PASTA;
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setString( 1, acao );
			for( int indice = 2; indice <= 5; indice++ ) consulta.setObject( indice, usuario );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				while( resultado.next() ) pastas.add( resultado.getObject( "ID_PASTA", UUID.class ) );
			}
		}
		return pastas;
	}

	private static Direitos calcularDireitos( UUID id, Map<UUID, Pasta> pastas, Set<UUID> leitura, Set<UUID> inclusao,
		Set<UUID> gestores, Map<UUID, Direitos> resolvidos, Set<UUID> emVisita ) {

		Direitos pronto = resolvidos.get( id );
		if( pronto != null ) return pronto;
		if( !emVisita.add( id ) ) throw new IllegalStateException( "Ciclo na hierarquia de pastas: " + id );
		Pasta pasta = pastas.get( id );
		if( pasta.pai() != null && !pastas.containsKey( pasta.pai() ) ) {
			emVisita.remove( id );
			Direitos ocultos = new Direitos( false, false, false );
			resolvidos.put( id, ocultos );
			return ocultos;
		}
		Direitos herdados = new Direitos( false, false, false );
		if( pasta.pai() != null && pastas.containsKey( pasta.pai() ) ) {
			herdados = calcularDireitos( pasta.pai(), pastas, leitura, inclusao, gestores, resolvidos, emVisita );
		}
		Direitos direitos = new Direitos( leitura.contains( id ) || herdados.leitura(),
			inclusao.contains( id ) || herdados.inclusao(), gestores.contains( id ) || herdados.gestao() );
		resolvidos.put( id, direitos );
		emVisita.remove( id );
		return direitos;
	}

	private static JSONArray caminho( Pasta pasta, Map<UUID, Pasta> pastas ) throws Exception {

		List<Pasta> invertido = new ArrayList<>();
		Set<UUID> vistos = new HashSet<>();
		while( pasta != null && vistos.add( pasta.id() ) ) {
			invertido.add( pasta );
			if( pasta.pai() == null ) break;
			pasta = pastas.get( pasta.pai() );
		}
		JSONArray caminho = new JSONArray();
		for( int indice = invertido.size() - 1; indice >= 0; indice-- ) {
			Pasta item = invertido.get( indice );
			caminho.put( new JSONObject().put( "idPasta", item.id().toString() ).put( "nome", item.nome() ) );
		}
		return caminho;
	}

	private static JSONArray carregarArquivos( Conexao conexao, UUID pasta, UUID usuario, Direitos direitos ) throws Exception {

		JSONArray arquivos = new JSONArray();
		if( !direitos.algum() ) return arquivos;
		Set<UUID> restritos = new HashSet<>();
		String restricoes = "select distinct p.ID_ARQUIVO from Docs.ARQUIVO_PERMISSOES p "
			+ "join Docs.ARQUIVOS a on a.ID_ARQUIVO = p.ID_ARQUIVO where a.ID_PASTA = ? "
			+ "and p.DT_INICIO <= CURRENT_TIMESTAMP and (p.DT_FIM is null or p.DT_FIM > CURRENT_TIMESTAMP)";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( restricoes ) ) {
			consulta.setObject( 1, pasta );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				while( resultado.next() ) restritos.add( resultado.getObject( "ID_ARQUIVO", UUID.class ) );
			}
		}

		Set<UUID> liberados = new HashSet<>();
		if( !direitos.gestao() ) {
			String sql = "select distinct p.ID_ARQUIVO from Docs.ARQUIVO_PERMISSOES p "
				+ "join Docs.ARQUIVOS a on a.ID_ARQUIVO = p.ID_ARQUIVO where a.ID_PASTA = ? "
				+ "and p.DT_INICIO <= CURRENT_TIMESTAMP and (p.DT_FIM is null or p.DT_FIM > CURRENT_TIMESTAMP) "
				+ "and " + DESTINATARIO_ARQUIVO;
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
				consulta.setObject( 1, pasta );
				for( int indice = 2; indice <= 5; indice++ ) consulta.setObject( indice, usuario );
				try ( ResultSet resultado = consulta.executeQuery() ) {
					while( resultado.next() ) liberados.add( resultado.getObject( "ID_ARQUIVO", UUID.class ) );
				}
			}
		}

		String sql = "select a.ID_ARQUIVO, a.DS_NOME_ARQUIVO, a.DS_TITULO, a.DS_DESCRICAO, a.CD_CONTENT_TYPE, "
			+ "a.TP_CLASSIFICACAO, a.DT_VENCIMENTO, a.DT_INCLUSAO, v.NR_VERSAO, v.NR_TAMANHO_BYTES "
			+ "from Docs.ARQUIVOS a left join lateral (select NR_VERSAO, NR_TAMANHO_BYTES from Docs.ARQUIVO_VERSOES "
			+ "where ID_ARQUIVO = a.ID_ARQUIVO order by NR_VERSAO desc limit 1) v on true "
			+ "where a.ID_PASTA = ? and a.DT_LIXEIRA is null and a.DT_EXCLUSAO is null "
			+ "order by lower(a.DS_NOME_ARQUIVO), a.ID_ARQUIVO";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, pasta );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				while( resultado.next() ) {
					UUID id = resultado.getObject( "ID_ARQUIVO", UUID.class );
					if( !direitos.gestao() && !( restritos.contains( id ) ? liberados.contains( id ) : direitos.leitura() ) ) continue;
					JSONObject item = new JSONObject().put( "idArquivo", id.toString() )
						.put( "nome", resultado.getString( "DS_NOME_ARQUIVO" ) ).put( "titulo", resultado.getString( "DS_TITULO" ) )
						.put( "descricao", nulo( resultado.getString( "DS_DESCRICAO" ) ) )
						.put( "contentType", nulo( resultado.getString( "CD_CONTENT_TYPE" ) ) )
						.put( "classificacao", resultado.getString( "TP_CLASSIFICACAO" ) )
						.put( "vencimento", data( resultado, "DT_VENCIMENTO" ) )
						.put( "inclusao", data( resultado, "DT_INCLUSAO" ) )
						.put( "versao", resultado.getObject( "NR_VERSAO" ) == null ? JSONObject.NULL : resultado.getInt( "NR_VERSAO" ) )
						.put( "tamanhoBytes", resultado.getObject( "NR_TAMANHO_BYTES" ) == null ? JSONObject.NULL : resultado.getLong( "NR_TAMANHO_BYTES" ) );
					arquivos.put( item );
				}
			}
		}
		return arquivos;
	}

	private static String destinatario( String alias, String usuario, String grupo, String tag ) {

		return "((" + alias + ".TP_DESTINATARIO = '" + usuario + "' and " + alias + ".ID_USUARIO_SISTEMA = ?) "
			+ "or (" + alias + ".TP_DESTINATARIO = '" + grupo + "' and exists (select 1 from Cadastro.USUARIO_GRUPOS ug "
			+ "join Cadastro.GRUPOS g on g.ID_GRUPO = ug.ID_GRUPO where ug.ID_USUARIO_SISTEMA = ? "
			+ "and ug.ID_GRUPO = " + alias + ".ID_GRUPO and ug.SN_ATIVO and g.SN_ATIVO "
				+ "and (" + alias + ".CD_TAG is null or exists (select 1 from Cadastro.GRUPO_TAGS gt "
				+ "join Cadastro.TAGS t on t.CD_TAG = gt.CD_TAG where gt.ID_GRUPO = ug.ID_GRUPO "
				+ "and gt.CD_TAG = " + alias + ".CD_TAG and gt.SN_ATIVA and t.SN_ATIVA and t.SN_GRUPO)))) "
				+ "or (" + alias + ".TP_DESTINATARIO = '" + tag + "' and exists (select 1 from Cadastro.TAGS t "
				+ "where t.CD_TAG = " + alias + ".CD_TAG and t.SN_ATIVA) and (exists (select 1 from Cadastro.USUARIO_TAGS ut "
				+ "join Cadastro.TAGS t on t.CD_TAG = ut.CD_TAG where ut.ID_USUARIO_SISTEMA = ? "
				+ "and ut.CD_TAG = " + alias + ".CD_TAG and ut.SN_ATIVA and t.SN_USUARIO) "
				+ "or exists (select 1 from Cadastro.USUARIO_GRUPOS ug join Cadastro.GRUPOS g on g.ID_GRUPO = ug.ID_GRUPO "
				+ "join Cadastro.GRUPO_TAGS gt on gt.ID_GRUPO = ug.ID_GRUPO "
				+ "join Cadastro.TAGS t on t.CD_TAG = gt.CD_TAG where ug.ID_USUARIO_SISTEMA = ? "
				+ "and ug.SN_ATIVO and g.SN_ATIVO and gt.SN_ATIVA and t.SN_GRUPO "
				+ "and gt.CD_TAG = " + alias + ".CD_TAG))))";
	}

	private static Object data( ResultSet resultado, String coluna ) throws SQLException {

		Timestamp valor = resultado.getTimestamp( coluna );
		return valor == null ? JSONObject.NULL : valor.toInstant().toString();
	}

	private static Object nulo( String valor ) {

		return valor == null ? JSONObject.NULL : valor;
	}
}
