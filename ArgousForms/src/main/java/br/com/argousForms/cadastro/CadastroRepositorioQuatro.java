package br.com.argousForms.cadastro;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import br.com.argousforms.model.negocio.cadastro.ConfirmacaoEmailNegocio;
import br.com.argousforms.model.negocio.cadastro.UsuarioOrigemLoginNegocio;
import br.com.argousforms.model.negocio.cadastro.UsuarioSistemaNegocio;
import br.com.argousforms.model.persistencia.cadastro.ConfirmacaoEmail;
import br.com.argousforms.model.persistencia.cadastro.ConfirmacaoEmailLocalizador;
import br.com.argousforms.model.persistencia.cadastro.OrigemLogin;
import br.com.argousforms.model.persistencia.cadastro.OrigemLoginLocalizador;
import br.com.argousforms.model.persistencia.cadastro.UsuarioOrigemLogin;
import br.com.argousforms.model.persistencia.cadastro.UsuarioOrigemLoginLocalizador;
import br.com.argousforms.model.persistencia.cadastro.UsuarioSistema;
import br.com.argousforms.model.persistencia.cadastro.UsuarioSistemaLocalizador;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;

final class CadastroRepositorioQuatro implements CadastroRepositorio {

	@Override
	public Transacao abrir() throws Exception {
		return new TransacaoQuatro(PoolDeConexoes.getConexao());
	}

	private static final class TransacaoQuatro implements Transacao {
		private final Conexao conexao;

		private TransacaoQuatro(Conexao conexao) {
			this.conexao = conexao;
		}

		public void iniciar() throws Exception {
			conexao.beginTransaction();
		}

		public void commit() throws Exception {
			conexao.commit();
		}

		public void rollback() throws Exception {
			if (conexao.inTransaction()) conexao.rollback();
		}

		public void close() throws Exception {
			conexao.close();
		}

		public void bloquearEmail(String email) throws Exception {
			// Serializa cadastro, confirmação e reenvio para o mesmo e-mail, inclusive antes da primeira inclusão.
			try (Query query = new Query(conexao)) {
				query.setSQL("select pg_advisory_xact_lock(73421, hashtext(:email))");
				query.setParameter("email", email);
				query.executeQuery();
			}
		}

		public OrigemLogin origem(UUID id) throws Exception {

			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select * from Cadastro.ORIGENS_LOGIN where CD_ORIGEM = :codigo" );
				query.setParameter( "codigo", 1 );
				query.executeQuery();
				if( query.isEmpty() ) return null;

				OrigemLogin origem = new OrigemLogin();
				OrigemLoginLocalizador.buscaCampos( origem, query );
				if( query.next() ) throw new IllegalStateException( "Origem de login local ambígua." );
				if( !id.equals( origem.getIdOrigemLogin() ) ) throw new IllegalStateException( "A origem de login local mudou durante o cadastro." );

				return origem;
			}
		}

		public UsuarioSistema usuario( String email ) throws Exception {

			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select * from Cadastro.USUARIOS_SISTEMA where lower(trim(DS_EMAIL)) = :email" );
				query.setParameter( "email", email );
				query.executeQuery();
				if( query.isEmpty() ) return null;

				UsuarioSistema usuario = new UsuarioSistema();
				UsuarioSistemaLocalizador.buscaCampos( usuario, query );
				if( query.next() ) throw new IllegalStateException( "Cadastro com e-mail ambíguo." );

				return usuario;
			}
		}

		public UsuarioOrigemLogin vinculo( UUID usuario, UUID origem ) throws Exception {

			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select * from Cadastro.USUARIO_ORIGENS_LOGIN where ID_USUARIO_SISTEMA = :usuario and ID_ORIGEM_LOGIN = :origem" );
				query.setParameter( "usuario", usuario );
				query.setParameter( "origem", origem );
				query.executeQuery();
				if( query.isEmpty() ) return null;

				UsuarioOrigemLogin vinculo = new UsuarioOrigemLogin();
				UsuarioOrigemLoginLocalizador.buscaCampos( vinculo, query );
				if( query.next() ) throw new IllegalStateException( "Vínculo de login ambíguo." );

				return vinculo;
			}
		}

		public List<ConfirmacaoEmail> confirmacoes( UUID usuario ) throws Exception {

			List<ConfirmacaoEmail> resultado = new ArrayList<>();
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select * from Cadastro.CONFIRMACOES_EMAIL where ID_USUARIO_SISTEMA = :usuario order by DT_INCLUSAO desc" );
				query.setParameter( "usuario", usuario );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						ConfirmacaoEmail confirmacao = new ConfirmacaoEmail();
						ConfirmacaoEmailLocalizador.buscaCampos( confirmacao, query );
						resultado.add( confirmacao );
					} while ( query.next() );
				}
			}

			return resultado;
		}

		public void inserir(UsuarioSistema usuario) throws Exception {
			new UsuarioSistemaNegocio(conexao, usuario).insere();
		}

		public void inserir(UsuarioOrigemLogin vinculo) throws Exception {
			new UsuarioOrigemLoginNegocio(conexao, vinculo).insere();
		}

		public void inserir(ConfirmacaoEmail confirmacao) throws Exception {
			new ConfirmacaoEmailNegocio(conexao, confirmacao).insere();
		}

		public void alterar(UsuarioOrigemLogin vinculo) throws Exception {
			new UsuarioOrigemLoginNegocio(conexao, vinculo).altera();
		}

		public void alterar(ConfirmacaoEmail confirmacao) throws Exception {
			new ConfirmacaoEmailNegocio(conexao, confirmacao).altera();
		}
	}
}
