package br.com.argousForms.pessoas;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import javax.mail.internet.InternetAddress;
import javax.servlet.ServletContext;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.cadastro.CadastroConfiguracao;
import br.com.argousForms.email.EmailException;
import br.com.argousForms.email.EmailService;
import br.com.argousForms.model.negocio.cadastro.ConfirmacaoEmailNegocio;
import br.com.argousForms.model.negocio.cadastro.ConfirmacaoEmailNegocioEspecifico;
import br.com.argousForms.model.negocio.cadastro.HistoricoLoginNegocio;
import br.com.argousForms.model.negocio.cadastro.PessoaIdentificacaoNegocio;
import br.com.argousForms.model.negocio.cadastro.PessoaNacionalidadeNegocio;
import br.com.argousForms.model.negocio.cadastro.PessoaNegocio;
import br.com.argousForms.model.negocio.cadastro.UsuarioOrigemLoginNegocio;
import br.com.argousForms.model.negocio.cadastro.UsuarioPerfilNegocio;
import br.com.argousForms.model.negocio.cadastro.UsuarioSistemaNegocio;
import br.com.argousForms.model.persistencia.cadastro.ConfirmacaoEmail;
import br.com.argousForms.model.persistencia.cadastro.ConfirmacaoEmailLocalizador;
import br.com.argousForms.model.persistencia.cadastro.HistoricoLogin;
import br.com.argousForms.model.persistencia.cadastro.HistoricoLoginLocalizador;
import br.com.argousForms.model.persistencia.cadastro.Pessoa;
import br.com.argousForms.model.persistencia.cadastro.PessoaIdentificacao;
import br.com.argousForms.model.persistencia.cadastro.PessoaIdentificacaoLocalizador;
import br.com.argousForms.model.persistencia.cadastro.PessoaLocalizador;
import br.com.argousForms.model.persistencia.cadastro.PessoaNacionalidade;
import br.com.argousForms.model.persistencia.cadastro.UsuarioOrigemLogin;
import br.com.argousForms.model.persistencia.cadastro.UsuarioOrigemLoginLocalizador;
import br.com.argousForms.model.persistencia.cadastro.UsuarioPerfil;
import br.com.argousForms.model.persistencia.cadastro.UsuarioPerfilLocalizador;
import br.com.argousForms.model.persistencia.cadastro.UsuarioSistema;
import br.com.argousForms.model.persistencia.cadastro.UsuarioSistemaLocalizador;
import br.com.argousForms.security.CodigoConfirmacao;
import br.com.argousForms.security.PoliticaSenha;
import br.com.argousForms.security.SenhaSegura;

import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;
import quatro.util.QtData;

public final class ManutencaoUsuarioService {

	public record Resultado( UUID idUsuario, UUID idConfirmacao, boolean emailEnviado, boolean confirmacaoPendente ) {}
	private record Emissao( UUID idConfirmacao, String codigo, String email, boolean convite ) {}

	public Resultado salvar( JSONObject dados, UUID idAutenticado, boolean proprio, ServletContext contexto ) throws Exception {

		UUID idUsuario = proprio ? idAutenticado : uuid( dados, "idUsuario" );
		UUID idPessoa = proprio ? null : uuid( dados, "idPessoa" );
		String nome = texto( dados, "nome", 200, true );
		String email = normalizarEmail( dados.optString( "email", "" ) );
		String nomeSocial = texto( dados, "nomeSocial", 255, false );
		String telefone = texto( dados, "telefone", 30, false );
		String sexo = texto( dados, "sexo", 1, false );
		if( sexo != null && !Set.of( "M", "F", "O", "P" ).contains( sexo ) ) throw invalido( "Sexo inválido." );
		QtData nascimento = nascimento( dados.optString( "nascimento", "" ) );
		JSONArray nacionalidades = dados.optJSONArray( "nacionalidades" );
		JSONArray identificacoes = dados.optJSONArray( "identificacoes" );
		if( nacionalidades == null || identificacoes == null ) throw invalido( "Informe as listas de nacionalidades e identificações." );
		Emissao emissao = null;
		UUID salvo;

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				bloquearEmail( conexao, email );
				UsuarioSistema usuario = idUsuario == null ? null : usuario( conexao, idUsuario );
				if( idUsuario != null && ( usuario == null || proprio && usuario.getDtExclusao() != null ) ) throw new ArgousFormsApiException( 404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado." );
				if( usuario != null && idPessoa != null && !idPessoa.equals( usuario.getIdPessoa() ) ) throw invalido( "A Pessoa não corresponde ao usuário." );
				Pessoa pessoa = usuario != null ? pessoa( conexao, usuario.getIdPessoa() ) : idPessoa == null ? null : pessoa( conexao, idPessoa );
				if( idPessoa != null && pessoa == null ) throw invalido( "Pessoa selecionada não encontrada." );
				UUID pessoaPorDocumento = localizarPessoaPorDocumento( conexao, identificacoes );
				if( pessoaPorDocumento != null && pessoa != null && !pessoa.getIdPessoa().equals( pessoaPorDocumento ) ) throw new ArgousFormsApiException( 409, "DOCUMENTO_EM_OUTRA_PESSOA", "A identificação pertence a outra Pessoa." );
				if( pessoaPorDocumento != null && pessoa == null ) throw new ArgousFormsApiException( 409, "PESSOA_EXISTENTE", "A identificação já pertence a uma Pessoa. Localize e selecione o registro para revisar os dados." );
				if( usuario == null && pessoa != null ) usuario = usuarioDaPessoa( conexao, pessoa.getIdPessoa() );
				if( usuario != null && idUsuario == null && usuario.getDtExclusao() == null ) throw new ArgousFormsApiException( 409, "PESSOA_COM_CONTA", "Esta Pessoa já possui conta ativa." );
				boolean novaPessoa = pessoa == null;
				if( novaPessoa ) {
					pessoa = new Pessoa();
					pessoa.setIdPessoa( UUID.randomUUID() );
					pessoa.setDtInclusao( agora() );
				} else if( !proprio && idPessoa != null && ( usuario == null || usuario.getDtExclusao() != null )
					&& !dados.optBoolean( "divergenciasRevisadas", false ) ) {
					throw new ArgousFormsApiException( 409, "REVISAR_PESSOA", "Revise os dados da Pessoa existente antes de criar ou reativar a conta." );
				}
				pessoa.setDsNomePessoa( nome );
				pessoa.setDsNomeSocial( nomeSocial );
				pessoa.setDsTelefone( telefone );
				pessoa.setTpSexo( sexo );
				pessoa.setDtNascimento( nascimento );
				if( novaPessoa ) pessoa.setDsEndEmail( email );
				if( novaPessoa ) new PessoaNegocio( conexao, pessoa ).insere();
				else new PessoaNegocio( conexao, pessoa ).altera();
				atualizarNacionalidades( conexao, pessoa.getIdPessoa(), nacionalidades );
				atualizarIdentificacoes( conexao, pessoa.getIdPessoa(), identificacoes );

				boolean novoUsuario = usuario == null;
				boolean reativacao = !novoUsuario && usuario.getDtExclusao() != null;
				boolean convite = novoUsuario || reativacao || usuario.getCdHashSenha() == null;
				verificarEmailLivre( conexao, email, novoUsuario ? null : usuario.getIdUsuarioSistema() );
				if( novoUsuario ) {
					usuario = new UsuarioSistema();
					usuario.setIdUsuarioSistema( UUID.randomUUID() );
					usuario.setIdPessoa( pessoa.getIdPessoa() );
					usuario.setDtInclusao( agora() );
				} else if( convite ) {
					usuario.setDtExclusao( null );
					usuario.setCdHashSenha( null );
					revogarSessoes( conexao, usuario.getIdUsuarioSistema() );
					revogarPerfis( conexao, usuario.getIdUsuarioSistema() );
				}
				boolean mudouEmail = !novoUsuario && !convite && !email.equals( usuario.getDsEmail() );
				usuario.setDsNome( nome );
				usuario.setDtNascimento( nascimento );
				if( !mudouEmail ) {
					usuario.setDsEmail( email );
					pessoa.setDsEndEmail( email );
					if( !novaPessoa ) new PessoaNegocio( conexao, pessoa ).altera();
				}
				if( novoUsuario ) new UsuarioSistemaNegocio( conexao, usuario ).insere();
				else new UsuarioSistemaNegocio( conexao, usuario ).altera();
				if( convite ) {
					vinculoLocal( conexao, usuario.getIdUsuarioSistema(), email );
					emissao = emitirCodigo( conexao, usuario.getIdUsuarioSistema(), email, true, contexto );
				} else if( mudouEmail ) emissao = emitirCodigo( conexao, usuario.getIdUsuarioSistema(), email, false, contexto );
				if( !proprio ) atualizarPerfis( conexao, usuario.getIdUsuarioSistema(), reativacao ? new JSONArray() : dados.optJSONArray( "perfis" ), convite );
				salvo = usuario.getIdUsuarioSistema();
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}

		boolean enviado = emissao == null || enviar( emissao );
		return new Resultado( salvo, emissao == null ? null : emissao.idConfirmacao(), enviado, emissao != null );
	}

	public UUID salvarPessoa( JSONObject dados ) throws Exception {

		UUID idPessoa = uuid( dados, "idPessoa" );
		String nome = texto( dados, "nome", 200, true );
		String nomeSocial = texto( dados, "nomeSocial", 255, false );
		String telefone = texto( dados, "telefone", 30, false );
		String sexo = texto( dados, "sexo", 1, false );
		if( sexo != null && !Set.of( "M", "F", "O", "P" ).contains( sexo ) ) throw invalido( "Sexo inválido." );
		String emailInformado = texto( dados, "email", 120, false );
		String email = emailInformado == null ? null : normalizarEmail( emailInformado );
		QtData nascimento = nascimento( dados.optString( "nascimento", "" ) );
		JSONArray nacionalidades = dados.optJSONArray( "nacionalidades" );
		JSONArray identificacoes = dados.optJSONArray( "identificacoes" );
		if( nacionalidades == null || identificacoes == null ) throw invalido( "Informe nacionalidades e identificações." );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				Pessoa pessoa = idPessoa == null ? null : pessoa( conexao, idPessoa );
				if( idPessoa != null && pessoa == null ) throw invalido( "Pessoa não encontrada." );
				if( pessoa != null ) {
					UsuarioSistema conta = usuarioDaPessoa( conexao, pessoa.getIdPessoa() );
					if( conta != null && conta.getDtExclusao() == null ) throw new ArgousFormsApiException( 409, "PESSOA_COM_CONTA", "Edite esta Pessoa pelo cadastro do usuário." );
				}
				UUID encontrada = localizarPessoaPorDocumento( conexao, identificacoes );
				if( encontrada != null && ( pessoa == null || !encontrada.equals( idPessoa ) ) ) throw new ArgousFormsApiException( 409, "PESSOA_EXISTENTE", "A identificação já pertence a outra Pessoa. Abra o registro existente." );
				boolean nova = pessoa == null;
				if( nova ) {
					pessoa = new Pessoa();
					pessoa.setIdPessoa( UUID.randomUUID() );
					pessoa.setDtInclusao( agora() );
				}
				pessoa.setDsNomePessoa( nome );
				pessoa.setDsNomeSocial( nomeSocial );
				pessoa.setDsEndEmail( email );
				pessoa.setDsTelefone( telefone );
				pessoa.setTpSexo( sexo );
				pessoa.setDtNascimento( nascimento );
				if( nova ) new PessoaNegocio( conexao, pessoa ).insere();
				else new PessoaNegocio( conexao, pessoa ).altera();
				atualizarNacionalidades( conexao, pessoa.getIdPessoa(), nacionalidades );
				atualizarIdentificacoes( conexao, pessoa.getIdPessoa(), identificacoes );
				conexao.commit();
				return pessoa.getIdPessoa();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private static String texto( JSONObject dados, String campo, int limite, boolean obrigatorio ) throws ArgousFormsApiException {

		Object bruto = dados.opt( campo );
		if( bruto != null && bruto != JSONObject.NULL && !( bruto instanceof String ) ) throw invalido( "Confira o campo " + campo + "." );
		String valor = bruto instanceof String ? ( (String) bruto ).strip() : "";
		if( valor.length() > limite || obrigatorio && valor.isEmpty() ) throw invalido( "Confira o campo " + campo + "." );
		return valor.isEmpty() ? null : valor;
	}

	private static String normalizarEmail( String email ) throws ArgousFormsApiException {

		String valor = email.strip().toLowerCase( Locale.ROOT );
		if( valor.isBlank() || valor.length() > 120 || valor.contains( "\r" ) || valor.contains( "\n" ) ) throw invalido( "Informe um e-mail válido." );
		try {
			InternetAddress endereco = new InternetAddress( valor, true );
			endereco.validate();
			if( !valor.equals( endereco.getAddress() ) || endereco.getPersonal() != null || endereco.isGroup() ) throw invalido( "Informe somente o endereço de e-mail." );
		} catch ( javax.mail.internet.AddressException e ) {
			throw invalido( "Informe um e-mail válido." );
		}
		return valor;
	}

	private static QtData nascimento( String valor ) throws ArgousFormsApiException {

		if( valor == null || valor.isBlank() ) return null;
		try { return new QtData( LocalDate.parse( valor ) ); }
		catch ( RuntimeException e ) { throw invalido( "Data de nascimento inválida." ); }
	}

	private static UUID uuid( JSONObject dados, String campo ) throws ArgousFormsApiException {

		String valor = dados.optString( campo, "" );
		if( valor.isBlank() ) return null;
		try { return UUID.fromString( valor ); }
		catch ( IllegalArgumentException e ) { throw invalido( "Identificador inválido: " + campo + "." ); }
	}

	private static QtData agora() { return new QtData( Instant.now().toEpochMilli() ); }
	private static ArgousFormsApiException invalido( String mensagem ) { return new ArgousFormsApiException( 400, "DADOS_INVALIDOS", mensagem ); }

	private static void bloquearEmail( Conexao conexao, String email ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select pg_advisory_xact_lock(73421, hashtext(:email))" );
			query.setParameter( "email", email );
			query.executeQuery();
		}
	}

	private static Pessoa pessoa( Conexao conexao, UUID id ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.PESSOAS where ID_PESSOA = :id" );
			query.setParameter( "id", id.toString() );
			query.executeQuery();
			if( query.isEmpty() ) return null;
			Pessoa pessoa = new Pessoa();
			PessoaLocalizador.buscaCampos( pessoa, query );
			return pessoa;
		}
	}

	private static UsuarioSistema usuario( Conexao conexao, UUID id ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.USUARIOS_SISTEMA where ID_USUARIO_SISTEMA = :id" );
			query.setParameter( "id", id.toString() );
			query.executeQuery();
			if( query.isEmpty() ) return null;
			UsuarioSistema usuario = new UsuarioSistema();
			UsuarioSistemaLocalizador.buscaCampos( usuario, query );
			return usuario;
		}
	}

	private static UsuarioSistema usuarioDaPessoa( Conexao conexao, UUID idPessoa ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.USUARIOS_SISTEMA where ID_PESSOA = :id" );
			query.setParameter( "id", idPessoa.toString() );
			query.executeQuery();
			if( query.isEmpty() ) return null;
			UsuarioSistema usuario = new UsuarioSistema();
			UsuarioSistemaLocalizador.buscaCampos( usuario, query );
			return usuario;
		}
	}

	private static UUID localizarPessoaPorDocumento( Conexao conexao, JSONArray identificacoes ) throws Exception {

		UUID encontrada = null;
		for( int indice = 0; indice < identificacoes.length(); indice++ ) {
			JSONObject item = identificacoes.optJSONObject( indice );
			if( item == null ) throw invalido( "Identificação inválida." );
			String numero = item.optString( "numero", "" ).strip();
			if( numero.isBlank() ) continue;
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_PESSOA from Cadastro.PESSOA_IDENTIFICACOES where ID_PAIS = :pais and CD_IDENTIFICACAO = :numero" );
				query.setParameter( "pais", item.optInt( "idPais", -1 ) );
				query.setParameter( "numero", numero );
				query.executeQuery();
				if( query.isEmpty() ) continue;
				UUID id = UUID.fromString( query.getString( "ID_PESSOA" ) );
				if( encontrada != null && !encontrada.equals( id ) ) throw new ArgousFormsApiException( 409, "DOCUMENTOS_DIVERGENTES", "As identificações pertencem a Pessoas diferentes." );
				encontrada = id;
			}
		}
		return encontrada;
	}

	public JSONObject localizar( int idPais, String numero ) throws Exception {

		if( idPais <= 0 || numero == null || numero.isBlank() || numero.length() > 70 ) throw invalido( "Informe país e identificação." );
		try ( Conexao conexao = PoolDeConexoes.getConexao(); Query query = new Query( conexao ) ) {
			query.setSQL( "select p.ID_PESSOA, p.DS_NOME_PESSOA, p.DS_NOME_SOCIAL, p.DS_END_EMAIL, p.DS_TELEFONE, u.ID_USUARIO_SISTEMA, u.DT_EXCLUSAO from Cadastro.PESSOA_IDENTIFICACOES i join Cadastro.PESSOAS p on p.ID_PESSOA = i.ID_PESSOA left join Cadastro.USUARIOS_SISTEMA u on u.ID_PESSOA = p.ID_PESSOA where i.ID_PAIS = :pais and i.CD_IDENTIFICACAO = :numero" );
			query.setParameter( "pais", idPais );
			query.setParameter( "numero", numero.strip() );
			query.executeQuery();
			if( query.isEmpty() ) return new JSONObject().put( "encontrada", false );
			return new JSONObject().put( "encontrada", true ).put( "idPessoa", query.getString( "ID_PESSOA" ) )
				.put( "nome", query.getString( "DS_NOME_PESSOA" ) ).put( "nomeSocial", query.getString( "DS_NOME_SOCIAL" ) )
				.put( "email", query.getString( "DS_END_EMAIL" ) ).put( "telefone", query.getString( "DS_TELEFONE" ) )
				.put( "contaAtiva", query.getString( "ID_USUARIO_SISTEMA" ) != null && query.getDate( "DT_EXCLUSAO" ) == null );
		}
	}

	private static void atualizarNacionalidades( Conexao conexao, UUID idPessoa, JSONArray informadas ) throws Exception {

		Set<Integer> desejadas = new HashSet<>();
		for( int indice = 0; indice < informadas.length(); indice++ ) {
			Object valor = informadas.get( indice );
			if( !( valor instanceof Integer id ) || id <= 0 || !desejadas.add( id ) ) throw invalido( "Nacionalidades inválidas ou repetidas." );
		}
		Set<Integer> atuais = new HashSet<>();
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select ID_PAIS from Cadastro.PESSOA_NACIONALIDADES where ID_PESSOA = :id" );
			query.setParameter( "id", idPessoa.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) do { atuais.add( query.getInt( "ID_PAIS" ) ); } while ( query.next() );
		}
		for( Integer id : atuais ) if( !desejadas.contains( id ) ) {
			PessoaNacionalidade registro = new PessoaNacionalidade();
			registro.setIdPessoa( idPessoa );
			registro.setIdPais( id );
			new PessoaNacionalidadeNegocio( conexao, registro ).exclui();
		}
		for( Integer id : desejadas ) if( !atuais.contains( id ) ) {
			PessoaNacionalidade registro = new PessoaNacionalidade();
			registro.setIdPessoa( idPessoa );
			registro.setIdPais( id );
			new PessoaNacionalidadeNegocio( conexao, registro ).insere();
		}
	}

	private static void atualizarIdentificacoes( Conexao conexao, UUID idPessoa, JSONArray informadas ) throws Exception {

		Map<Integer, JSONObject> desejadas = new HashMap<>();
		Set<Integer> tipos = new HashSet<>();
		for( int indice = 0; indice < informadas.length(); indice++ ) {
			JSONObject item = informadas.optJSONObject( indice );
			if( item == null ) throw invalido( "Identificação inválida." );
			int pais = item.optInt( "idPais", -1 );
			int tipo = item.optInt( "idTipo", -1 );
			String numero = item.optString( "numero", "" ).strip();
			if( pais <= 0 || tipo <= 0 || numero.isBlank() || numero.length() > 70 || desejadas.putIfAbsent( pais, item ) != null || !tipos.add( tipo ) ) throw invalido( "Identificações inválidas ou repetidas." );
		}
		Set<Integer> preservadas = new HashSet<>();
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.PESSOA_IDENTIFICACOES where ID_PESSOA = :id" );
			query.setParameter( "id", idPessoa.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) do {
				PessoaIdentificacao atual = new PessoaIdentificacao();
				PessoaIdentificacaoLocalizador.buscaCampos( atual, query );
				JSONObject novo = desejadas.get( atual.getIdPais() );
				if( novo == null || novo.optInt( "idTipo", -1 ) != atual.getIdTipoIdentificacao() ) new PessoaIdentificacaoNegocio( conexao, atual ).exclui();
				else {
					preservadas.add( atual.getIdPais() );
					String numero = novo.getString( "numero" ).strip();
					if( !numero.equals( atual.getCdIdentificacao() ) ) {
						atual.setCdIdentificacao( numero );
						new PessoaIdentificacaoNegocio( conexao, atual ).altera();
					}
				}
			} while ( query.next() );
		}
		for( Map.Entry<Integer, JSONObject> entrada : desejadas.entrySet() ) if( !preservadas.contains( entrada.getKey() ) ) {
			JSONObject item = entrada.getValue();
			PessoaIdentificacao nova = new PessoaIdentificacao();
			nova.setIdPessoa( idPessoa );
			nova.setIdPais( entrada.getKey() );
			nova.setIdTipoIdentificacao( item.getInt( "idTipo" ) );
			nova.setCdIdentificacao( item.getString( "numero" ).strip() );
			nova.setDtInclusao( agora() );
			new PessoaIdentificacaoNegocio( conexao, nova ).insere();
		}
	}

	private static void verificarEmailLivre( Conexao conexao, String email, UUID idUsuario ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select ID_USUARIO_SISTEMA from Cadastro.USUARIOS_SISTEMA where lower(trim(DS_EMAIL)) = :email" );
			query.setParameter( "email", email );
			query.executeQuery();
			if( !query.isEmpty() && ( idUsuario == null || !idUsuario.toString().equals( query.getString( "ID_USUARIO_SISTEMA" ) ) ) ) {
				throw new ArgousFormsApiException( 409, "EMAIL_EM_USO", "Este e-mail já está associado a uma conta." );
			}
		}
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select ID_USUARIO_SISTEMA from Cadastro.CONFIRMACOES_EMAIL where DS_EMAIL = :email and DT_CONFIRMACAO is null and DT_REVOGACAO is null and DT_VALIDADE > CURRENT_TIMESTAMP" );
			query.setParameter( "email", email );
			query.executeQuery();
			if( !query.isEmpty() ) do {
				if( idUsuario == null || !idUsuario.toString().equals( query.getString( "ID_USUARIO_SISTEMA" ) ) ) {
					throw new ArgousFormsApiException( 409, "EMAIL_EM_USO", "Este e-mail está reservado para uma confirmação pendente." );
				}
			} while ( query.next() );
		}
	}

	private static void revogarSessoes( Conexao conexao, UUID idUsuario ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select h.* from Cadastro.HISTORICO_LOGINS h join Cadastro.USUARIO_ORIGENS_LOGIN v on v.ID_USUARIO_ORIGEM_LOGIN = h.ID_USUARIO_ORIGEM_LOGIN where v.ID_USUARIO_SISTEMA = :id and h.DT_REVOGACAO is null" );
			query.setParameter( "id", idUsuario.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) do {
				HistoricoLogin sessao = new HistoricoLogin();
				HistoricoLoginLocalizador.buscaCampos( sessao, query );
				sessao.setDtRevogacao( agora() );
				new HistoricoLoginNegocio( conexao, sessao ).altera();
			} while ( query.next() );
		}
	}

	private static void revogarPerfis( Conexao conexao, UUID idUsuario ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.USUARIO_PERFIS where ID_USUARIO_SISTEMA = :id and DT_REVOGACAO is null" );
			query.setParameter( "id", idUsuario.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) do {
				UsuarioPerfil perfil = new UsuarioPerfil();
				UsuarioPerfilLocalizador.buscaCampos( perfil, query );
				perfil.setDtRevogacao( agora() );
				new UsuarioPerfilNegocio( conexao, perfil ).altera();
			} while ( query.next() );
		}
	}

	private static void atualizarPerfis( Conexao conexao, UUID idUsuario, JSONArray informados, boolean padrao ) throws Exception {

		if( informados == null ) throw invalido( "Informe os perfis do usuário." );
		Set<UUID> desejados = new HashSet<>();
		for( int indice = 0; indice < informados.length(); indice++ ) {
			try { desejados.add( UUID.fromString( informados.getString( indice ) ) ); }
			catch ( IllegalArgumentException e ) { throw invalido( "Perfil inválido." ); }
		}
		Set<String> basicos = new HashSet<>();
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select ID_PERFIL, CD_PERFIL from Cadastro.PERFIS where CD_PERFIL in ('ESSENCIAL','PARTICIPANTE') and SN_ATIVO = true and DT_EXCLUSAO is null" );
			query.executeQuery();
			if( !query.isEmpty() ) do {
				String codigo = query.getString( "CD_PERFIL" );
				if( "ESSENCIAL".equals( codigo ) || padrao && "PARTICIPANTE".equals( codigo ) ) {
					basicos.add( codigo );
					desejados.add( UUID.fromString( query.getString( "ID_PERFIL" ) ) );
				}
			} while ( query.next() );
		}
		if( !basicos.contains( "ESSENCIAL" ) || padrao && !basicos.contains( "PARTICIPANTE" ) ) throw new ArgousFormsApiException( 503, "PERFIL_INDISPONIVEL", "Os perfis básicos não estão disponíveis." );
		for( UUID id : desejados ) try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select ID_PERFIL from Cadastro.PERFIS where ID_PERFIL = :id and SN_ATIVO = true and DT_EXCLUSAO is null" );
			query.setParameter( "id", id.toString() );
			query.executeQuery();
			if( query.isEmpty() ) throw invalido( "Um dos perfis não está ativo." );
		}
		Set<UUID> existentes = new HashSet<>();
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.USUARIO_PERFIS where ID_USUARIO_SISTEMA = :id" );
			query.setParameter( "id", idUsuario.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) do {
				UsuarioPerfil perfil = new UsuarioPerfil();
				UsuarioPerfilLocalizador.buscaCampos( perfil, query );
				existentes.add( perfil.getIdPerfil() );
				boolean desejado = desejados.contains( perfil.getIdPerfil() );
				boolean revogado = perfil.getDtRevogacao() != null;
				boolean expirado = perfil.getDtFimVigencia() != null && perfil.getDtFimVigencia().getTimeInMillis() <= System.currentTimeMillis();
				if( desejado && !revogado && !expirado || !desejado && revogado ) continue;
				perfil.setDtRevogacao( desejado ? null : agora() );
				if( desejado ) {
					perfil.setDtInicioVigencia( agora() );
					perfil.setDtFimVigencia( null );
				}
				new UsuarioPerfilNegocio( conexao, perfil ).altera();
			} while ( query.next() );
		}
		for( UUID id : desejados ) if( !existentes.contains( id ) ) {
			UsuarioPerfil perfil = new UsuarioPerfil();
			perfil.setIdUsuarioSistema( idUsuario );
			perfil.setIdPerfil( id );
			perfil.setDtInclusao( agora() );
			perfil.setDtInicioVigencia( agora() );
			new UsuarioPerfilNegocio( conexao, perfil ).insere();
		}
	}

	private static void vinculoLocal( Conexao conexao, UUID idUsuario, String email ) throws Exception {

		UUID idOrigem;
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select ID_ORIGEM_LOGIN from Cadastro.ORIGENS_LOGIN where CD_ORIGEM = 1 and TP_AUTENTICACAO = 'L' and SN_ATIVA = true and DT_EXCLUSAO is null" );
			query.executeQuery();
			if( query.isEmpty() ) throw new ArgousFormsApiException( 503, "ORIGEM_INDISPONIVEL", "A origem local não está disponível." );
			idOrigem = UUID.fromString( query.getString( "ID_ORIGEM_LOGIN" ) );
		}
		UsuarioOrigemLogin vinculo = null;
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.USUARIO_ORIGENS_LOGIN where ID_USUARIO_SISTEMA = :id and ID_ORIGEM_LOGIN = :origem" );
			query.setParameter( "id", idUsuario.toString() );
			query.setParameter( "origem", idOrigem.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) {
				vinculo = new UsuarioOrigemLogin();
				UsuarioOrigemLoginLocalizador.buscaCampos( vinculo, query );
			}
		}
		boolean novo = vinculo == null;
		if( novo ) {
			vinculo = new UsuarioOrigemLogin();
			vinculo.setIdUsuarioOrigemLogin( UUID.randomUUID() );
			vinculo.setIdUsuarioSistema( idUsuario );
			vinculo.setIdOrigemLogin( idOrigem );
			vinculo.setDtInclusao( agora() );
		}
		vinculo.setCdUsuarioNaOrigem( email );
		vinculo.setDsEmailOrigem( email );
		vinculo.setSnEmailVerificado( false );
		vinculo.setDtRevogacao( null );
		if( novo ) new UsuarioOrigemLoginNegocio( conexao, vinculo ).insere();
		else new UsuarioOrigemLoginNegocio( conexao, vinculo ).altera();
	}

	private static Emissao emitirCodigo( Conexao conexao, UUID idUsuario, String email, boolean convite, ServletContext contexto ) throws Exception {

		CodigoConfirmacao codigos = CadastroConfiguracao.codigos( contexto );
		int enviosNaHora = 0;
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.CONFIRMACOES_EMAIL where ID_USUARIO_SISTEMA = :id" );
			query.setParameter( "id", idUsuario.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) do {
				ConfirmacaoEmail anterior = new ConfirmacaoEmail();
				ConfirmacaoEmailLocalizador.buscaCampos( anterior, query );
				long idade = System.currentTimeMillis() - anterior.getDtInclusao().getTimeInMillis();
				if( idade >= 0 && idade < 3_600_000 ) enviosNaHora++;
				if( idade >= 0 && idade < 60_000 || enviosNaHora >= 5 ) {
					throw new ArgousFormsApiException( 429, "REENVIO_LIMITADO", "Aguarde antes de solicitar outro código." );
				}
				if( anterior.getDtConfirmacao() == null && anterior.getDtRevogacao() == null ) {
					anterior.setDtRevogacao( agora() );
					new ConfirmacaoEmailNegocio( conexao, anterior ).altera();
				}
			} while ( query.next() );
		}
		String codigo = codigos.gerar();
		ConfirmacaoEmail confirmacao = new ConfirmacaoEmail();
		confirmacao.setIdUsuarioSistema( idUsuario );
		confirmacao.setDsEmail( email );
		confirmacao.setCdHashToken( ConfirmacaoEmailNegocioEspecifico.HASH_AGUARDANDO );
		confirmacao.setDtInclusao( agora() );
		confirmacao.setDtValidade( new QtData( Instant.now().plusSeconds( 600 ).toEpochMilli() ) );
		confirmacao.setNrTentativasInvalidas( 0 );
		new ConfirmacaoEmailNegocio( conexao, confirmacao ).insere();
		if( confirmacao.getIdConfirmacaoEmail() == null ) throw new IllegalStateException( "A confirmação não recebeu identificador." );
		confirmacao.setCdHashToken( codigos.hash( confirmacao.getIdConfirmacaoEmail(), idUsuario, email, codigo ) );
		new ConfirmacaoEmailNegocio( conexao, confirmacao ).altera();
		return new Emissao( confirmacao.getIdConfirmacaoEmail(), codigo, email, convite );
	}

	private static boolean enviar( Emissao emissao ) {

		try {
			EmailService email = new EmailService();
			if( emissao.convite() ) email.enviarConvite( emissao.email(), emissao.codigo() );
			else email.enviarTrocaEmail( emissao.email(), emissao.codigo() );
			return true;
		} catch ( EmailException e ) {
			return false;
		}
	}

	public void confirmarConvite( String emailInformado, String codigo, String senha, ServletContext contexto ) throws Exception {

		if( !PoliticaSenha.atende( senha ) ) throw invalido( "A nova senha não atende à política de segurança." );
		confirmarCodigo( emailInformado, codigo, senha, contexto );
	}

	public void confirmarTrocaEmail( String emailInformado, String codigo, UUID idAutenticado, ServletContext contexto ) throws Exception {

		confirmarCodigo( emailInformado, codigo, idAutenticado, contexto );
	}

	private static void confirmarCodigo( String emailInformado, String codigo, Object credencial, ServletContext contexto ) throws Exception {

		String email = normalizarEmail( emailInformado );
		if( codigo == null || !codigo.replace( "-", "" ).matches( "[0-9]{8}" ) ) throw codigoInvalido();
		String normalizado = codigo.replace( "-", "" );
		ArgousFormsApiException rejeicao = null;
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				bloquearEmail( conexao, email );
				ConfirmacaoEmail confirmacao;
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select c.* from Cadastro.CONFIRMACOES_EMAIL c join Cadastro.USUARIOS_SISTEMA u on u.ID_USUARIO_SISTEMA = c.ID_USUARIO_SISTEMA where c.DS_EMAIL = :email and c.DT_CONFIRMACAO is null and c.DT_REVOGACAO is null"
						+ ( credencial instanceof UUID ? " and c.ID_USUARIO_SISTEMA = :usuario" : " and u.CD_HASH_SENHA is null" ) + " order by c.DT_INCLUSAO desc" );
					query.setParameter( "email", email );
					if( credencial instanceof UUID idUsuario ) query.setParameter( "usuario", idUsuario.toString() );
					query.executeQuery();
					if( query.isEmpty() ) throw codigoInvalido();
					confirmacao = new ConfirmacaoEmail();
					ConfirmacaoEmailLocalizador.buscaCampos( confirmacao, query );
				}
				UUID idConfirmacao = confirmacao.getIdConfirmacaoEmail();
				UsuarioSistema usuario = usuario( conexao, confirmacao.getIdUsuarioSistema() );
				boolean convite = credencial instanceof String;
				if( usuario == null || usuario.getDtExclusao() != null || !email.equals( confirmacao.getDsEmail() )
					|| confirmacao.getDtConfirmacao() != null || confirmacao.getDtRevogacao() != null
					|| confirmacao.getDtValidade() == null || confirmacao.getDtValidade().getTimeInMillis() <= System.currentTimeMillis()
					|| convite && usuario.getCdHashSenha() != null
					|| !convite && ( !usuario.getIdUsuarioSistema().equals( credencial ) || usuario.getCdHashSenha() == null || email.equals( usuario.getDsEmail() ) ) ) throw codigoInvalido();
				int tentativas = confirmacao.getNrTentativasInvalidas() == null ? 0 : confirmacao.getNrTentativasInvalidas();
				if( tentativas >= 5 ) throw codigoInvalido();
				if( !CadastroConfiguracao.codigos( contexto ).confere( idConfirmacao, usuario.getIdUsuarioSistema(), email, normalizado, confirmacao.getCdHashToken() ) ) {
					confirmacao.setNrTentativasInvalidas( tentativas + 1 );
					if( tentativas + 1 >= 5 ) confirmacao.setDtRevogacao( agora() );
					new ConfirmacaoEmailNegocio( conexao, confirmacao ).altera();
					rejeicao = codigoInvalido();
				} else {
					confirmacao.setDtConfirmacao( agora() );
					new ConfirmacaoEmailNegocio( conexao, confirmacao ).altera();
					if( convite ) usuario.setCdHashSenha( SenhaSegura.gerarHash( (String) credencial ) );
					else {
						verificarEmailLivre( conexao, email, usuario.getIdUsuarioSistema() );
						usuario.setDsEmail( email );
					}
					new UsuarioSistemaNegocio( conexao, usuario ).altera();
					Pessoa pessoa = pessoa( conexao, usuario.getIdPessoa() );
					if( pessoa != null ) {
						pessoa.setDsEndEmail( email );
						new PessoaNegocio( conexao, pessoa ).altera();
					}
					if( convite ) confirmarVinculoLocal( conexao, usuario.getIdUsuarioSistema(), email );
					else atualizarEmailVinculoLocal( conexao, usuario.getIdUsuarioSistema(), email );
				}
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
		if( rejeicao != null ) throw rejeicao;
	}

	private static void confirmarVinculoLocal( Conexao conexao, UUID idUsuario, String email ) throws Exception {

		alterarVinculoLocal( conexao, idUsuario, email, false );
	}

	private static void atualizarEmailVinculoLocal( Conexao conexao, UUID idUsuario, String email ) throws Exception {

		alterarVinculoLocal( conexao, idUsuario, email, true );
	}

	private static void alterarVinculoLocal( Conexao conexao, UUID idUsuario, String email, boolean atualizarEmail ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select v.* from Cadastro.USUARIO_ORIGENS_LOGIN v join Cadastro.ORIGENS_LOGIN o on o.ID_ORIGEM_LOGIN = v.ID_ORIGEM_LOGIN where v.ID_USUARIO_SISTEMA = :id and o.CD_ORIGEM = 1 and v.DT_REVOGACAO is null" );
			query.setParameter( "id", idUsuario.toString() );
			query.executeQuery();
			if( query.isEmpty() ) throw codigoInvalido();
			UsuarioOrigemLogin vinculo = new UsuarioOrigemLogin();
			UsuarioOrigemLoginLocalizador.buscaCampos( vinculo, query );
			if( atualizarEmail ) {
				vinculo.setCdUsuarioNaOrigem( email );
				vinculo.setDsEmailOrigem( email );
			}
			vinculo.setSnEmailVerificado( true );
			new UsuarioOrigemLoginNegocio( conexao, vinculo ).altera();
		}
	}

	private static ArgousFormsApiException codigoInvalido() {
		return new ArgousFormsApiException( 400, "CODIGO_INVALIDO", "Código inválido, expirado ou já utilizado." );
	}
}
