package br.com.argousForms.cadastro;

import java.util.List;
import java.util.UUID;

import br.com.argousForms.model.persistencia.cadastro.ConfirmacaoEmail;
import br.com.argousForms.model.persistencia.cadastro.OrigemLogin;
import br.com.argousForms.model.persistencia.cadastro.Perfil;
import br.com.argousForms.model.persistencia.cadastro.UsuarioOrigemLogin;
import br.com.argousForms.model.persistencia.cadastro.UsuarioPerfil;
import br.com.argousForms.model.persistencia.cadastro.UsuarioSistema;

/** Cada operação externa abre e controla uma única unidade transacional. */
interface CadastroRepositorio {

	Transacao abrir() throws Exception;

	interface Transacao extends AutoCloseable {
		
		void iniciar() throws Exception;
		void commit() throws Exception;
		void rollback() throws Exception;
		void bloquearEmail(String email) throws Exception;
		OrigemLogin origem(UUID id) throws Exception;
		Perfil perfilAtivo( String codigo ) throws Exception;
		UsuarioSistema usuario(String email) throws Exception;
		UsuarioOrigemLogin vinculo(UUID usuario, UUID origem) throws Exception;
		List<ConfirmacaoEmail> confirmacoes(UUID usuario) throws Exception;
		void inserir(UsuarioSistema usuario) throws Exception;
		void inserir(UsuarioOrigemLogin vinculo) throws Exception;
		void inserir( UsuarioPerfil perfil ) throws Exception;
		void inserir(ConfirmacaoEmail confirmacao) throws Exception;
		void alterar(UsuarioOrigemLogin vinculo) throws Exception;
		void alterar(ConfirmacaoEmail confirmacao) throws Exception;
		@Override
		void close() throws Exception;
	}
}
